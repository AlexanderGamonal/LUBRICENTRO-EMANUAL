-- 017_fechas_timezone.sql
-- Fase 4: Fechas y Robustez
-- Ajustar current_date para que siempre use America/Lima en lugar del UTC del servidor

-- 1. Helper para obtener fecha en Lima
create or replace function hoy_lima()
returns date
language sql
immutable
as $$
  select (now() at time zone 'America/Lima')::date;
$$;

-- 2. Actualizar defaults de tablas
alter table cajas alter column fecha set default hoy_lima();
alter table servicios alter column fecha_servicio set default hoy_lima();

-- 3. Actualizar vistas que ya lo hacian bien pero para estandarizar
-- vw_ganancias_ventas y vw_ganancias_servicios ya usaban (created_at at time zone 'America/Lima')::date
-- Podemos dejarlas así porque usan la fecha del registro created_at, no "hoy".

-- 4. Actualizar registrar_servicio para usar hoy_lima() en lugar de current_date
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
  p_detalles_pago  jsonb    default null
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
begin
  v_usuario_id  := current_usuario_id();
  v_sucursal_id := current_sucursal_id();

  if v_usuario_id is null then raise exception 'No autenticado'; end if;

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
    hoy_lima(), 0, coalesce(p_monto_servicio, 0)
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
