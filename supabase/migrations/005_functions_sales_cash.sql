-- 005_functions_sales_cash.sql
-- Funciones RPC para ventas, caja y créditos

-- ============================================================
-- RPC: abrir_caja
-- Abre una nueva caja para el usuario actual.
-- Impide más de una caja abierta por sucursal.
-- ============================================================
create or replace function abrir_caja(
  p_monto_apertura numeric default 0
)
returns cajas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id  uuid;
  v_sucursal_id uuid;
  v_caja_existe uuid;
  v_caja        cajas;
begin
  v_usuario_id  := current_usuario_id();
  v_sucursal_id := current_sucursal_id();

  if v_usuario_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  -- Verificar que no haya caja abierta en esta sucursal
  select id into v_caja_existe
  from cajas
  where sucursal_id = v_sucursal_id
    and estado = 'abierta'
  limit 1;

  if found then
    raise exception 'Ya existe una caja abierta para esta sucursal. Ciérrela antes de abrir una nueva.';
  end if;

  insert into cajas (
    sucursal_id, usuario_id, monto_apertura, estado
  ) values (
    v_sucursal_id, v_usuario_id, p_monto_apertura, 'abierta'
  )
  returning * into v_caja;

  insert into auditoria_eventos (sucursal_id, usuario_id, entidad, entidad_id, accion, datos_nuevos)
  values (v_sucursal_id, v_usuario_id, 'cajas', v_caja.id, 'abrir_caja',
    jsonb_build_object('monto_apertura', p_monto_apertura));

  return v_caja;
end;
$$;

-- ============================================================
-- RPC: cerrar_caja
-- Cierra la caja abierta, calcula diferencia y registra auditoría.
-- ============================================================
create or replace function cerrar_caja(
  p_caja_id         uuid,
  p_monto_real      numeric,
  p_observaciones   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id    uuid;
  v_sucursal_id   uuid;
  v_caja          cajas;
  v_esperado      numeric;
  v_diferencia    numeric;
begin
  v_usuario_id  := current_usuario_id();
  v_sucursal_id := current_sucursal_id();

  -- Obtener caja y verificar pertenencia
  select * into v_caja
  from cajas
  where id = p_caja_id
    and sucursal_id = v_sucursal_id
    and estado = 'abierta'
  for update;

  if not found then
    raise exception 'Caja no encontrada, no pertenece a esta sucursal o ya está cerrada';
  end if;

  -- Calcular monto esperado: apertura + ingresos - egresos
  select v_caja.monto_apertura + coalesce(sum(
    case when tipo = 'ingreso' then monto else -monto end
  ), 0)
  into v_esperado
  from caja_movimientos
  where caja_id = p_caja_id;

  v_diferencia := p_monto_real - v_esperado;

  -- Cerrar caja
  update cajas set
    monto_cierre_esperado = v_esperado,
    monto_cierre_real     = p_monto_real,
    diferencia            = v_diferencia,
    estado                = 'cerrada',
    observaciones         = p_observaciones,
    closed_at             = now(),
    updated_at            = now()
  where id = p_caja_id;

  insert into auditoria_eventos (sucursal_id, usuario_id, entidad, entidad_id, accion, datos_anteriores, datos_nuevos)
  values (v_sucursal_id, v_usuario_id, 'cajas', p_caja_id, 'cerrar_caja',
    jsonb_build_object('estado', 'abierta', 'monto_apertura', v_caja.monto_apertura),
    jsonb_build_object('monto_esperado', v_esperado, 'monto_real', p_monto_real, 'diferencia', v_diferencia));

  return jsonb_build_object(
    'caja_id',          p_caja_id,
    'monto_apertura',   v_caja.monto_apertura,
    'monto_esperado',   v_esperado,
    'monto_real',       p_monto_real,
    'diferencia',       v_diferencia
  );
end;
$$;

-- ============================================================
-- RPC: crear_venta
-- Crea una venta completa en una sola transacción atómica:
-- inserta venta, items, descuenta stock, registra pago y movimiento de caja.
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
  v_usuario_id  uuid;
  v_sucursal_id uuid;
  v_caja_id     uuid;
  v_venta_id    uuid;
  v_subtotal    numeric := 0;
  v_total       numeric := 0;
  v_item        jsonb;
  v_prod_precio numeric;
  v_prod_stock  integer;
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

  -- Validar items y calcular subtotal
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta debe tener al menos un producto';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    -- Obtener precio y stock actuales del producto
    select precio_venta, stock_actual
    into v_prod_precio, v_prod_stock
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

  -- Insertar items y descontar stock
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select precio_venta into v_prod_precio
    from productos
    where id = (v_item->>'producto_id')::uuid;

    v_item_subtotal := coalesce((v_item->>'precio_unitario')::numeric, v_prod_precio)
                       * (v_item->>'cantidad')::integer;

    insert into venta_items (
      sucursal_id, venta_id, producto_id, cantidad, precio_unitario, subtotal
    ) values (
      v_sucursal_id, v_venta_id,
      (v_item->>'producto_id')::uuid,
      (v_item->>'cantidad')::integer,
      coalesce((v_item->>'precio_unitario')::numeric, v_prod_precio),
      v_item_subtotal
    );

    -- Descontar stock mediante RPC de inventario
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
    -- Crear crédito si el medio de pago es crédito
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
-- RPC: anular_venta
-- Anula una venta: revierte stock, ajusta caja y registra auditoría.
-- ============================================================
create or replace function anular_venta(
  p_venta_id uuid,
  p_motivo   text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id  uuid;
  v_sucursal_id uuid;
  v_venta       ventas;
  v_item        venta_items;
begin
  v_usuario_id  := current_usuario_id();
  v_sucursal_id := current_sucursal_id();

  if not is_admin_or_above() then
    raise exception 'Solo administradores pueden anular ventas';
  end if;

  if p_motivo is null or trim(p_motivo) = '' then
    raise exception 'El motivo de anulación es obligatorio';
  end if;

  select * into v_venta
  from ventas
  where id = p_venta_id
    and sucursal_id = v_sucursal_id
  for update;

  if not found then
    raise exception 'Venta no encontrada';
  end if;

  if v_venta.estado = 'anulada' then
    raise exception 'La venta ya está anulada';
  end if;

  -- Revertir stock por cada item
  for v_item in
    select * from venta_items where venta_id = p_venta_id
  loop
    if v_item.producto_id is not null then
      perform registrar_movimiento_stock(
        v_item.producto_id,
        'devolucion',
        v_item.cantidad,
        'Anulación de venta: ' || p_motivo,
        'ventas',
        p_venta_id
      );
    end if;
  end loop;

  -- Registrar egreso en caja si no era crédito
  if v_venta.medio_pago <> 'credito' and v_venta.caja_id is not null then
    insert into caja_movimientos (
      sucursal_id, caja_id, tipo, monto, medio_pago, descripcion,
      referencia_tipo, referencia_id, usuario_id
    ) values (
      v_sucursal_id, v_venta.caja_id, 'egreso', v_venta.total, v_venta.medio_pago,
      'Anulación de venta: ' || p_motivo, 'ventas', p_venta_id, v_usuario_id
    );
  end if;

  -- Marcar venta como anulada
  update ventas set estado = 'anulada', updated_at = now()
  where id = p_venta_id;

  insert into auditoria_eventos (sucursal_id, usuario_id, entidad, entidad_id, accion, datos_anteriores, datos_nuevos)
  values (v_sucursal_id, v_usuario_id, 'ventas', p_venta_id, 'anular_venta',
    jsonb_build_object('estado', 'emitida', 'total', v_venta.total),
    jsonb_build_object('estado', 'anulada', 'motivo', p_motivo));

  return jsonb_build_object('venta_id', p_venta_id, 'estado', 'anulada', 'motivo', p_motivo);
end;
$$;

-- ============================================================
-- RPC: registrar_servicio
-- Registra un servicio de mantenimiento vehicular con productos usados.
-- ============================================================
create or replace function registrar_servicio(
  p_vehiculo_id   uuid,
  p_descripcion   text,
  p_items         jsonb,
  p_kilometraje   integer  default null,
  p_observaciones text     default null,
  p_cliente_id    uuid     default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id  uuid;
  v_sucursal_id uuid;
  v_servicio_id uuid;
  v_total       numeric := 0;
  v_item        jsonb;
  v_prod_precio numeric;
  v_item_sub    numeric;
begin
  v_usuario_id  := current_usuario_id();
  v_sucursal_id := current_sucursal_id();

  if v_usuario_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  -- Insertar servicio
  insert into servicios (
    sucursal_id, vehiculo_id, cliente_id, usuario_id,
    kilometraje, descripcion, observaciones, estado, fecha_servicio, total
  ) values (
    v_sucursal_id, p_vehiculo_id, p_cliente_id, v_usuario_id,
    p_kilometraje, p_descripcion, p_observaciones, 'pendiente', current_date, 0
  )
  returning id into v_servicio_id;

  -- Insertar productos y descontar stock
  if p_items is not null and jsonb_array_length(p_items) > 0 then
    for v_item in select * from jsonb_array_elements(p_items)
    loop
      select precio_venta into v_prod_precio
      from productos
      where id = (v_item->>'producto_id')::uuid
        and sucursal_id = v_sucursal_id
        and activo = true;

      if not found then
        raise exception 'Producto % no encontrado', v_item->>'producto_id';
      end if;

      v_item_sub := coalesce((v_item->>'precio_unitario')::numeric, v_prod_precio)
                    * (v_item->>'cantidad')::integer;
      v_total := v_total + v_item_sub;

      insert into servicio_productos (
        sucursal_id, servicio_id, producto_id, cantidad, precio_unitario, subtotal
      ) values (
        v_sucursal_id, v_servicio_id,
        (v_item->>'producto_id')::uuid,
        (v_item->>'cantidad')::integer,
        coalesce((v_item->>'precio_unitario')::numeric, v_prod_precio),
        v_item_sub
      );

      perform registrar_movimiento_stock(
        (v_item->>'producto_id')::uuid,
        'servicio',
        (v_item->>'cantidad')::integer,
        'Servicio vehicular',
        'servicios',
        v_servicio_id
      );
    end loop;
  end if;

  -- Actualizar total del servicio
  update servicios set total = v_total where id = v_servicio_id;

  return jsonb_build_object('servicio_id', v_servicio_id, 'total', v_total);
end;
$$;

-- ============================================================
-- RPC: registrar_pago_credito
-- Registra el pago (parcial o total) de un crédito.
-- ============================================================
create or replace function registrar_pago_credito(
  p_credito_id uuid,
  p_monto      numeric,
  p_medio_pago medio_pago default 'efectivo',
  p_referencia text       default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id  uuid;
  v_sucursal_id uuid;
  v_credito     creditos_cliente;
  v_saldo_nuevo numeric;
  v_caja_id     uuid;
begin
  v_usuario_id  := current_usuario_id();
  v_sucursal_id := current_sucursal_id();

  if v_usuario_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if p_monto <= 0 then
    raise exception 'El monto del pago debe ser mayor a cero';
  end if;

  select * into v_credito
  from creditos_cliente
  where id = p_credito_id
    and sucursal_id = v_sucursal_id
    and estado not in ('pagado')
  for update;

  if not found then
    raise exception 'Crédito no encontrado o ya está saldado';
  end if;

  if p_monto > v_credito.saldo then
    raise exception 'El monto (%) supera el saldo del crédito (%)', p_monto, v_credito.saldo;
  end if;

  v_saldo_nuevo := v_credito.saldo - p_monto;

  update creditos_cliente set
    monto_pagado = monto_pagado + p_monto,
    saldo        = v_saldo_nuevo,
    estado       = case when v_saldo_nuevo = 0 then 'pagado'
                        when v_saldo_nuevo < monto_total then 'parcial'
                        else estado end,
    updated_at   = now()
  where id = p_credito_id;

  -- Registrar pago
  insert into pagos (
    sucursal_id, cliente_id, venta_id, medio_pago, monto, referencia, usuario_id
  ) values (
    v_sucursal_id, v_credito.cliente_id, v_credito.venta_id,
    p_medio_pago, p_monto, p_referencia, v_usuario_id
  );

  -- Registrar en caja si hay una abierta
  select id into v_caja_id from cajas
  where sucursal_id = v_sucursal_id and estado = 'abierta' limit 1;

  if v_caja_id is not null then
    insert into caja_movimientos (
      sucursal_id, caja_id, tipo, monto, medio_pago, descripcion,
      referencia_tipo, referencia_id, usuario_id
    ) values (
      v_sucursal_id, v_caja_id, 'ingreso', p_monto, p_medio_pago,
      'Cobro de crédito', 'creditos_cliente', p_credito_id, v_usuario_id
    );
  end if;

  insert into auditoria_eventos (sucursal_id, usuario_id, entidad, entidad_id, accion, datos_nuevos)
  values (v_sucursal_id, v_usuario_id, 'creditos_cliente', p_credito_id, 'pago_credito',
    jsonb_build_object('monto_pagado', p_monto, 'saldo_nuevo', v_saldo_nuevo));

  return jsonb_build_object(
    'credito_id',    p_credito_id,
    'monto_pagado',  p_monto,
    'saldo_nuevo',   v_saldo_nuevo,
    'estado',        case when v_saldo_nuevo = 0 then 'pagado' else 'parcial' end
  );
end;
$$;
