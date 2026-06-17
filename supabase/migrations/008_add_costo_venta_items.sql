-- 008_add_costo_venta_items.sql
-- Feature 0: Guardar costo histórico en venta_items
-- Feature 3: Vista de ganancias por ventas

-- ============================================================
-- 1. Agregar costo_unitario a venta_items
-- Captura el costo del producto al momento exacto de la venta.
-- Las ventas anteriores quedan con costo_unitario = 0 (fallback al costo actual).
-- ============================================================
alter table venta_items
  add column costo_unitario numeric(10,2) not null default 0 check (costo_unitario >= 0);

-- ============================================================
-- 2. Recrear función crear_venta con captura de costo histórico
-- ============================================================
create or replace function crear_venta(
  p_items        jsonb,
  p_medio_pago   medio_pago,
  p_cliente_id   uuid     default null,
  p_descuento    numeric  default 0,
  p_observaciones text    default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id    uuid;
  v_sucursal_id   uuid;
  v_caja_id       uuid;
  v_venta_id      uuid;
  v_subtotal      numeric := 0;
  v_total         numeric := 0;
  v_item          jsonb;
  v_prod_precio   numeric;
  v_prod_costo    numeric;
  v_prod_stock    integer;
  v_item_subtotal numeric;
begin
  v_usuario_id  := current_usuario_id();
  v_sucursal_id := current_sucursal_id();

  if v_usuario_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  -- Verificar caja abierta
  select id into v_caja_id
  from cajas
  where sucursal_id = v_sucursal_id
    and estado = 'abierta'
  limit 1;

  if v_caja_id is null then
    raise exception 'No hay caja abierta. Abra la caja antes de registrar ventas.';
  end if;

  -- Validar items
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta debe tener al menos un producto';
  end if;

  -- Primera pasada: validar stock y calcular subtotal
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select precio_venta, costo, stock_actual
    into v_prod_precio, v_prod_costo, v_prod_stock
    from productos
    where id = (v_item->>'producto_id')::uuid
      and sucursal_id = v_sucursal_id
      and activo = true;

    if not found then
      raise exception 'Producto % no encontrado o inactivo', v_item->>'producto_id';
    end if;

    if v_prod_stock < (v_item->>'cantidad')::integer then
      raise exception 'Stock insuficiente para producto %. Disponible: %, solicitado: %',
        v_item->>'producto_id', v_prod_stock, (v_item->>'cantidad')::integer;
    end if;

    v_item_subtotal := coalesce((v_item->>'precio_unitario')::numeric, v_prod_precio)
                       * (v_item->>'cantidad')::integer;
    v_subtotal := v_subtotal + v_item_subtotal;
  end loop;

  v_total := v_subtotal - coalesce(p_descuento, 0);
  if v_total < 0 then v_total := 0; end if;

  -- Insertar venta
  insert into ventas (
    sucursal_id, usuario_id, cliente_id, caja_id,
    subtotal, descuento, total, medio_pago, estado
  ) values (
    v_sucursal_id, v_usuario_id, p_cliente_id, v_caja_id,
    v_subtotal, coalesce(p_descuento, 0), v_total, p_medio_pago, 'emitida'
  )
  returning id into v_venta_id;

  -- Segunda pasada: insertar items con costo histórico y descontar stock
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select precio_venta, costo
    into v_prod_precio, v_prod_costo
    from productos
    where id = (v_item->>'producto_id')::uuid;

    v_item_subtotal := coalesce((v_item->>'precio_unitario')::numeric, v_prod_precio)
                       * (v_item->>'cantidad')::integer;

    insert into venta_items (
      sucursal_id, venta_id, producto_id, cantidad,
      precio_unitario, costo_unitario, subtotal
    ) values (
      v_sucursal_id, v_venta_id,
      (v_item->>'producto_id')::uuid,
      (v_item->>'cantidad')::integer,
      coalesce((v_item->>'precio_unitario')::numeric, v_prod_precio),
      coalesce(v_prod_costo, 0),   -- ← costo capturado al momento de la venta
      v_item_subtotal
    );

    -- Descontar stock
    perform registrar_movimiento_stock(
      (v_item->>'producto_id')::uuid,
      'venta',
      (v_item->>'cantidad')::integer,
      'Venta registrada',
      'ventas',
      v_venta_id
    );
  end loop;

  -- Registrar en caja si el pago no es crédito
  if p_medio_pago <> 'credito' then
    insert into caja_movimientos (
      sucursal_id, caja_id, tipo, monto, medio_pago, descripcion,
      referencia_tipo, referencia_id, usuario_id
    ) values (
      v_sucursal_id, v_caja_id, 'ingreso', v_total, p_medio_pago,
      'Venta de productos', 'ventas', v_venta_id, v_usuario_id
    );

    insert into pagos (
      sucursal_id, cliente_id, venta_id, caja_id,
      medio_pago, monto, usuario_id
    ) values (
      v_sucursal_id, p_cliente_id, v_venta_id, v_caja_id,
      p_medio_pago, v_total, v_usuario_id
    );
  else
    if p_cliente_id is null then
      raise exception 'Para ventas a crédito debe especificar un cliente';
    end if;

    insert into creditos_cliente (
      sucursal_id, cliente_id, venta_id, monto_total, monto_pagado, saldo, estado
    ) values (
      v_sucursal_id, p_cliente_id, v_venta_id, v_total, 0, v_total, 'pendiente'
    );
  end if;

  insert into auditoria_eventos (sucursal_id, usuario_id, entidad, entidad_id, accion, datos_nuevos)
  values (v_sucursal_id, v_usuario_id, 'ventas', v_venta_id, 'crear_venta',
    jsonb_build_object('total', v_total, 'medio_pago', p_medio_pago));

  return jsonb_build_object(
    'venta_id',   v_venta_id,
    'subtotal',   v_subtotal,
    'descuento',  p_descuento,
    'total',      v_total,
    'caja_id',    v_caja_id
  );
end;
$$;

-- ============================================================
-- 3. Vista de ganancias por ventas (Feature 3)
-- Usa costo_unitario histórico cuando está disponible (> 0),
-- y fallback al costo actual del producto para ventas antiguas.
-- ============================================================
create or replace view vw_ganancias_ventas as
select
  v.sucursal_id,
  date_trunc('day', v.created_at at time zone 'America/Lima')::date  as fecha,
  sum(vi.precio_unitario * vi.cantidad)                               as ingresos,
  sum(
    case when vi.costo_unitario > 0
         then vi.costo_unitario
         else coalesce(p.costo, 0)
    end * vi.cantidad
  )                                                                   as costo_real,
  sum(
    (vi.precio_unitario - case when vi.costo_unitario > 0
                               then vi.costo_unitario
                               else coalesce(p.costo, 0)
                          end) * vi.cantidad
  )                                                                   as ganancia,
  count(distinct v.id)                                                as total_ventas
from ventas v
join venta_items vi on vi.venta_id = v.id
join productos p    on p.id = vi.producto_id
where v.estado = 'emitida'
group by v.sucursal_id, date_trunc('day', v.created_at at time zone 'America/Lima')::date
order by fecha desc;
