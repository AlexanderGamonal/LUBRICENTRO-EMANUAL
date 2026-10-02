-- 018_pago_mixto_y_fecha_servicio.sql
-- 1. validar_detalles_pago(): reglas del pago mixto en el servidor.
--    Antes crear_venta aceptaba cualquier medio dentro del detalle (incluido 'credito',
--    que descuadra la caja) y montos que sumaban MÁS que el total (el excedente quedaba
--    registrado como ingreso). Ahora: medios en efectivo/yape/plin/tarjeta/transferencia,
--    montos > 0 y suma exacta (ventas) o sin exceder el total (servicios).
-- 2. registrar_servicio(): parámetro opcional p_fecha_servicio (null = hoy en Lima).
--    No se admiten fechas futuras ni de más de 365 días atrás. El cobro se registra en la
--    caja abierta HOY; solo cambia la fecha del servicio.
-- 3. vw_ganancias_servicios: agrupa por fecha_servicio (antes por created_at), para que una
--    atención registrada con fecha pasada se cuente en el día en que se hizo.
-- Aplicar en: Supabase Dashboard > SQL Editor (o `supabase db push`)

-- ============================================================
-- 1. Validación compartida del pago mixto
-- ============================================================
create or replace function validar_detalles_pago(
  p_detalles jsonb,
  p_total    numeric,
  p_exacto   boolean
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_detalle jsonb;
  v_medio   text;
  v_monto   numeric;
  v_suma    numeric := 0;
begin
  if p_detalles is null or jsonb_typeof(p_detalles) <> 'array' or jsonb_array_length(p_detalles) = 0 then
    raise exception 'Debe especificar los detalles del pago mixto';
  end if;

  for v_detalle in select * from jsonb_array_elements(p_detalles)
  loop
    v_medio := v_detalle->>'medio';
    v_monto := (v_detalle->>'monto')::numeric;

    if v_medio is null or v_medio not in ('efectivo', 'yape', 'plin', 'tarjeta', 'transferencia') then
      raise exception 'Medio de pago no válido en el pago mixto: %', coalesce(v_medio, '(vacío)');
    end if;
    if v_monto is null or v_monto <= 0 then
      raise exception 'Cada pago del pago mixto debe ser mayor a cero';
    end if;
    v_suma := v_suma + v_monto;
  end loop;

  if p_exacto and abs(v_suma - p_total) > 0.01 then
    raise exception 'La suma de los pagos (S/ %) debe ser igual al total (S/ %)', v_suma, p_total;
  end if;
  if not p_exacto and v_suma > p_total + 0.01 then
    raise exception 'La suma de los pagos (S/ %) no puede superar el total (S/ %)', v_suma, p_total;
  end if;
end;
$$;

revoke execute on function validar_detalles_pago(jsonb, numeric, boolean) from public, anon, authenticated;

-- ============================================================
-- 2. crear_venta con la validación compartida
-- ============================================================
create or replace function crear_venta(
  p_items          jsonb,
  p_medio_pago     medio_pago,
  p_cliente_id     uuid     default null,
  p_descuento      numeric  default 0,
  p_observaciones  text     default null,
  p_detalles_pago  jsonb    default null -- Para pagos mixtos: [{"medio": "efectivo", "monto": 50}, ...]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id    uuid;
  v_sucursal_id   uuid;
  v_rol           text;
  v_caja_id       uuid;
  v_venta_id      uuid;
  v_subtotal      numeric := 0;
  v_total         numeric := 0;
  v_item          jsonb;
  v_prod_precio   numeric;
  v_prod_costo    numeric;
  v_prod_stock    integer;
  v_precio_unit   numeric;
  v_item_subtotal numeric;
  
  -- Para mixto
  v_detalle       jsonb;
  v_suma_mixto    numeric := 0;
  v_monto_mixto   numeric;
  v_medio_mixto   medio_pago;
begin
  v_usuario_id  := current_usuario_id();
  v_sucursal_id := current_sucursal_id();
  v_rol         := current_user_role();

  if v_usuario_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  select id into v_caja_id from cajas
  where sucursal_id = v_sucursal_id and estado = 'abierta' limit 1;

  if v_caja_id is null then
    raise exception 'No hay caja abierta';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta debe tener al menos un producto';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select precio_venta, costo, stock_actual
    into v_prod_precio, v_prod_costo, v_prod_stock
    from productos
    where id = (v_item->>'producto_id')::uuid and sucursal_id = v_sucursal_id and activo = true;

    if not found then raise exception 'Producto % no encontrado', v_item->>'producto_id'; end if;

    if v_prod_stock < (v_item->>'cantidad')::integer then
      raise exception 'Stock insuficiente';
    end if;

    v_precio_unit := coalesce((v_item->>'precio_unitario')::numeric, v_prod_precio);
    
    -- Validacion: Vendedor no puede cambiar precio por debajo del precio_lista
    if v_rol = 'vendedor' and v_precio_unit < v_prod_precio then
      raise exception 'No tienes permisos para vender por debajo del precio de lista (S/ %)', v_prod_precio;
    end if;

    v_item_subtotal := v_precio_unit * (v_item->>'cantidad')::integer;
    v_subtotal := v_subtotal + v_item_subtotal;
  end loop;

  v_total := v_subtotal - coalesce(p_descuento, 0);
  if v_total < 0 then v_total := 0; end if;

  -- Validar pago mixto (medios permitidos, montos > 0 y suma exacta = total)
  if p_medio_pago = 'mixto' then
    perform validar_detalles_pago(p_detalles_pago, v_total, true);
  end if;

  insert into ventas (
    sucursal_id, usuario_id, cliente_id, caja_id,
    subtotal, descuento, total, medio_pago, estado
  ) values (
    v_sucursal_id, v_usuario_id, p_cliente_id, v_caja_id,
    v_subtotal, coalesce(p_descuento, 0), v_total, p_medio_pago, 'emitida'
  ) returning id into v_venta_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select precio_venta, costo into v_prod_precio, v_prod_costo
    from productos where id = (v_item->>'producto_id')::uuid;

    v_precio_unit := coalesce((v_item->>'precio_unitario')::numeric, v_prod_precio);
    v_item_subtotal := v_precio_unit * (v_item->>'cantidad')::integer;

    insert into venta_items (
      sucursal_id, venta_id, producto_id, cantidad, precio_unitario, costo_unitario, subtotal
    ) values (
      v_sucursal_id, v_venta_id, (v_item->>'producto_id')::uuid, (v_item->>'cantidad')::integer,
      v_precio_unit, coalesce(v_prod_costo, 0), v_item_subtotal
    );

    perform registrar_movimiento_stock(
      (v_item->>'producto_id')::uuid, 'venta', (v_item->>'cantidad')::integer,
      'Venta', 'ventas', v_venta_id
    );
  end loop;

  if p_medio_pago = 'mixto' then
    for v_detalle in select * from jsonb_array_elements(p_detalles_pago)
    loop
      v_monto_mixto := (v_detalle->>'monto')::numeric;
      v_medio_mixto := (v_detalle->>'medio')::text::medio_pago;

      if v_monto_mixto > 0 then
        insert into caja_movimientos (
          sucursal_id, caja_id, tipo, monto, medio_pago, descripcion,
          referencia_tipo, referencia_id, usuario_id
        ) values (
          v_sucursal_id, v_caja_id, 'ingreso', v_monto_mixto, v_medio_mixto,
          'Venta mixta', 'ventas', v_venta_id, v_usuario_id
        );
        insert into pagos (
          sucursal_id, cliente_id, venta_id, caja_id, medio_pago, monto, usuario_id
        ) values (
          v_sucursal_id, p_cliente_id, v_venta_id, v_caja_id, v_medio_mixto, v_monto_mixto, v_usuario_id
        );
      end if;
    end loop;
  elsif p_medio_pago <> 'credito' then
    insert into caja_movimientos (
      sucursal_id, caja_id, tipo, monto, medio_pago, descripcion,
      referencia_tipo, referencia_id, usuario_id
    ) values (
      v_sucursal_id, v_caja_id, 'ingreso', v_total, p_medio_pago,
      'Venta', 'ventas', v_venta_id, v_usuario_id
    );
    insert into pagos (
      sucursal_id, cliente_id, venta_id, caja_id, medio_pago, monto, usuario_id
    ) values (
      v_sucursal_id, p_cliente_id, v_venta_id, v_caja_id, p_medio_pago, v_total, v_usuario_id
    );
  else
    if p_cliente_id is null then raise exception 'Falta cliente para crédito'; end if;
    insert into creditos_cliente (
      sucursal_id, cliente_id, venta_id, monto_total, monto_pagado, saldo, estado
    ) values (
      v_sucursal_id, p_cliente_id, v_venta_id, v_total, 0, v_total, 'pendiente'
    );
  end if;

  return jsonb_build_object('venta_id', v_venta_id, 'total', v_total, 'caja_id', v_caja_id);
end;
$$;

-- ============================================================
-- 3. registrar_servicio con fecha opcional
-- ============================================================
drop function if exists registrar_servicio(uuid, text, jsonb, integer, text, uuid, numeric, medio_pago, numeric, jsonb);

create or replace function registrar_servicio(
  p_vehiculo_id    uuid,
  p_descripcion    text,
  p_items          jsonb,
  p_kilometraje    integer  default null,
  p_observaciones  text     default null,
  p_cliente_id     uuid     default null,
  p_monto_servicio numeric  default 0,
  p_medio_pago     medio_pago default 'efectivo',
  p_monto_pagado   numeric  default null,
  p_detalles_pago  jsonb    default null,
  p_fecha_servicio date     default null -- null = hoy (hora de Lima); permite registrar atenciones pasadas
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
  v_caja_id     uuid;
  v_total       numeric := 0;
  v_item        jsonb;
  v_prod_precio numeric;
  v_prod_costo  numeric;
  v_item_sub    numeric;
  v_detalle     jsonb;
  v_suma_mixto  numeric := 0;
  v_monto_mixto numeric;
  v_medio_mixto medio_pago;
  v_fecha       date;
begin
  v_usuario_id  := current_usuario_id();
  v_sucursal_id := current_sucursal_id();

  if v_usuario_id is null then raise exception 'No autenticado'; end if;

  v_fecha := coalesce(p_fecha_servicio, hoy_lima());
  if v_fecha > hoy_lima() then
    raise exception 'La fecha del servicio no puede ser futura';
  end if;
  if v_fecha < hoy_lima() - 365 then
    raise exception 'La fecha del servicio no puede tener más de un año de antigüedad';
  end if;

  select id into v_caja_id from cajas
  where sucursal_id = v_sucursal_id and estado = 'abierta' limit 1;

  if v_caja_id is null then raise exception 'No hay caja abierta'; end if;

  v_total := coalesce(p_monto_servicio, 0);

  insert into servicios (
    sucursal_id, vehiculo_id, cliente_id, usuario_id,
    kilometraje, descripcion, observaciones, estado,
    fecha_servicio, total, monto_servicio
  ) values (
    v_sucursal_id, p_vehiculo_id, p_cliente_id, v_usuario_id,
    p_kilometraje, p_descripcion, p_observaciones, 'terminado',
    v_fecha, 0, coalesce(p_monto_servicio, 0)
  ) returning id into v_servicio_id;

  if p_items is not null and jsonb_array_length(p_items) > 0 then
    for v_item in select * from jsonb_array_elements(p_items)
    loop
      select precio_venta, costo into v_prod_precio, v_prod_costo
      from productos
      where id = (v_item->>'producto_id')::uuid and sucursal_id = v_sucursal_id and activo = true;

      if not found then raise exception 'Producto % no encontrado', v_item->>'producto_id'; end if;

      v_item_sub := coalesce((v_item->>'precio_unitario')::numeric, v_prod_precio) * (v_item->>'cantidad')::integer;
      v_total := v_total + v_item_sub;

      insert into servicio_productos (
        sucursal_id, servicio_id, producto_id, cantidad, precio_unitario, costo_unitario, subtotal
      ) values (
        v_sucursal_id, v_servicio_id, (v_item->>'producto_id')::uuid, (v_item->>'cantidad')::integer,
        coalesce((v_item->>'precio_unitario')::numeric, v_prod_precio), coalesce(v_prod_costo, 0), v_item_sub
      );

      perform registrar_movimiento_stock(
        (v_item->>'producto_id')::uuid, 'servicio', (v_item->>'cantidad')::integer,
        'Servicio', 'servicios', v_servicio_id
      );
    end loop;
  end if;

  update servicios set total = v_total where id = v_servicio_id;

  if p_monto_pagado is null then
    if p_medio_pago = 'credito' then
      p_monto_pagado := 0;
    else
      p_monto_pagado := v_total;
    end if;
  end if;

  if p_medio_pago = 'mixto' then
    if p_detalles_pago is null or jsonb_array_length(p_detalles_pago) = 0 then
      raise exception 'Debe especificar los detalles';
    end if;
    -- Medios permitidos, montos > 0 y suma que no exceda el total (si queda saldo, pasa a crédito parcial)
    perform validar_detalles_pago(p_detalles_pago, v_total, false);
    for v_detalle in select * from jsonb_array_elements(p_detalles_pago)
    loop
      v_monto_mixto := (v_detalle->>'monto')::numeric;
      v_medio_mixto := (v_detalle->>'medio')::text::medio_pago;
      v_suma_mixto := v_suma_mixto + v_monto_mixto;

      if v_monto_mixto > 0 then
        insert into caja_movimientos (
          sucursal_id, caja_id, tipo, monto, medio_pago, descripcion, referencia_tipo, referencia_id, usuario_id
        ) values (
          v_sucursal_id, v_caja_id, 'ingreso', v_monto_mixto, v_medio_mixto,
          'Servicio: ' || p_descripcion, 'servicios', v_servicio_id, v_usuario_id
        );
      end if;
    end loop;
    p_monto_pagado := v_suma_mixto;
  elsif p_medio_pago <> 'credito' and p_monto_pagado > 0 then
    insert into caja_movimientos (
      sucursal_id, caja_id, tipo, monto, medio_pago, descripcion, referencia_tipo, referencia_id, usuario_id
    ) values (
      v_sucursal_id, v_caja_id, 'ingreso', p_monto_pagado, p_medio_pago,
      'Servicio: ' || p_descripcion, 'servicios', v_servicio_id, v_usuario_id
    );
  end if;

  if p_monto_pagado < v_total then
    if p_cliente_id is null then raise exception 'Falta cliente para crédito parcial'; end if;
    insert into creditos_cliente (
      sucursal_id, cliente_id, venta_id,
      monto_total, monto_pagado, saldo, estado
    ) values (
      v_sucursal_id, p_cliente_id, null, v_total, p_monto_pagado, v_total - p_monto_pagado, 'pendiente'
    );
  end if;

  return jsonb_build_object(
    'servicio_id', v_servicio_id, 'total', v_total, 'caja_id', v_caja_id
  );
end;
$$;

revoke execute on function registrar_servicio(uuid, text, jsonb, integer, text, uuid, numeric, medio_pago, numeric, jsonb, date) from public, anon;
grant execute on function registrar_servicio(uuid, text, jsonb, integer, text, uuid, numeric, medio_pago, numeric, jsonb, date) to authenticated;

-- ============================================================
-- 4. Rentabilidad de servicios por fecha del servicio
-- ============================================================
create or replace view vw_ganancias_servicios as
select
  s.sucursal_id,
  s.fecha_servicio                                                     as fecha,
  sum(s.total)                                                         as ingresos,
  coalesce(sum(sp_costs.costo_total), 0)                               as costo_real,
  sum(s.total) - coalesce(sum(sp_costs.costo_total), 0)                as ganancia,
  count(distinct s.id)                                                 as total_servicios,
  sum(coalesce(s.monto_servicio, 0))                                   as total_mano_obra
from servicios s
left join (
  select
    sp.servicio_id,
    sum(sp.cantidad * case when sp.costo_unitario > 0 then sp.costo_unitario else coalesce(p.costo, 0) end) as costo_total
  from servicio_productos sp
  join productos p on p.id = sp.producto_id
  group by sp.servicio_id
) sp_costs on sp_costs.servicio_id = s.id
where s.estado = 'terminado'
group by s.sucursal_id, s.fecha_servicio
order by fecha desc;

alter view vw_ganancias_servicios set (security_invoker = true);

-- ============================================================
-- 5. Limpieza de funciones antiguas y permisos de ejecución
-- ============================================================
-- La versión de 6 parámetros (migración 005) nunca se eliminó: seguía siendo invocable por
-- la API y se salta las reglas actuales (caja abierta, medio de pago, validaciones).
drop function if exists registrar_servicio(uuid, text, jsonb, integer, text, uuid);

-- Las migraciones 016-018 recrearon funciones y estas heredaron EXECUTE para anon/public.
-- Se vuelve a aplicar el patrón de 015: solo usuarios autenticados (y service_role).
revoke execute on all functions in schema public from public, anon;
grant  execute on all functions in schema public to authenticated, service_role;

-- Internas: solo las llaman otras funciones SECURITY DEFINER (dueño postgres)
revoke execute on function registrar_movimiento_stock(uuid, tipo_movimiento_stock, integer, text, text, uuid) from authenticated;
revoke execute on function validar_detalles_pago(jsonb, numeric, boolean) from authenticated;
