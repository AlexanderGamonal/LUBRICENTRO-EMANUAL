-- 016_integridad_negocio.sql
-- Fase 3: Integridad de Negocio
-- 1. Validaciones en crear_venta (precio minimo para vendedores, pago mixto)
-- 2. servicio_productos: add costo_unitario
-- 3. registrar_servicio: soporte pago mixto y creditos parciales
-- 4. anular_venta: manejo de caja cerrada
-- 5. anular_credito: egreso a caja abierta

-- ============================================================
-- 3.1 servicio_productos: costo_unitario
-- ============================================================
alter table servicio_productos 
add column if not exists costo_unitario numeric(10,2) not null default 0 check (costo_unitario >= 0);

-- ============================================================
-- 3.2 crear_venta: Validar precios y soporte mixto
-- ============================================================
drop function if exists crear_venta(jsonb, medio_pago, uuid, numeric, text);
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
    raise exception ''Usuario no autenticado'';
  end if;

  select id into v_caja_id from cajas
  where sucursal_id = v_sucursal_id and estado = ''abierta'' limit 1;

  if v_caja_id is null then
    raise exception ''No hay caja abierta'';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception ''La venta debe tener al menos un producto'';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select precio_venta, costo, stock_actual
    into v_prod_precio, v_prod_costo, v_prod_stock
    from productos
    where id = (v_item->>''producto_id'')::uuid and sucursal_id = v_sucursal_id and activo = true;

    if not found then raise exception ''Producto % no encontrado'', v_item->>''producto_id''; end if;

    if v_prod_stock < (v_item->>''cantidad'')::integer then
      raise exception ''Stock insuficiente'';
    end if;

    v_precio_unit := coalesce((v_item->>''precio_unitario'')::numeric, v_prod_precio);
    
    -- Validacion: Vendedor no puede cambiar precio por debajo del precio_lista
    if v_rol = ''vendedor'' and v_precio_unit < v_prod_precio then
      raise exception ''No tienes permisos para vender por debajo del precio de lista (S/ %)'', v_prod_precio;
    end if;

    v_item_subtotal := v_precio_unit * (v_item->>''cantidad'')::integer;
    v_subtotal := v_subtotal + v_item_subtotal;
  end loop;

  v_total := v_subtotal - coalesce(p_descuento, 0);
  if v_total < 0 then v_total := 0; end if;

  -- Validar pago mixto
  if p_medio_pago = ''mixto'' then
    if p_detalles_pago is null or jsonb_array_length(p_detalles_pago) = 0 then
      raise exception ''Debe especificar los detalles del pago mixto'';
    end if;
    for v_detalle in select * from jsonb_array_elements(p_detalles_pago)
    loop
      v_suma_mixto := v_suma_mixto + (v_detalle->>''monto'')::numeric;
    end loop;
    if v_suma_mixto < v_total then
      raise exception ''La suma de pagos mixtos (S/ %) no cubre el total (S/ %)'', v_suma_mixto, v_total;
    end if;
  end if;

  insert into ventas (
    sucursal_id, usuario_id, cliente_id, caja_id,
    subtotal, descuento, total, medio_pago, estado
  ) values (
    v_sucursal_id, v_usuario_id, p_cliente_id, v_caja_id,
    v_subtotal, coalesce(p_descuento, 0), v_total, p_medio_pago, ''emitida''
  ) returning id into v_venta_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select precio_venta, costo into v_prod_precio, v_prod_costo
    from productos where id = (v_item->>''producto_id'')::uuid;

    v_precio_unit := coalesce((v_item->>''precio_unitario'')::numeric, v_prod_precio);
    v_item_subtotal := v_precio_unit * (v_item->>''cantidad'')::integer;

    insert into venta_items (
      sucursal_id, venta_id, producto_id, cantidad, precio_unitario, costo_unitario, subtotal
    ) values (
      v_sucursal_id, v_venta_id, (v_item->>''producto_id'')::uuid, (v_item->>''cantidad'')::integer,
      v_precio_unit, coalesce(v_prod_costo, 0), v_item_subtotal
    );

    perform registrar_movimiento_stock(
      (v_item->>''producto_id'')::uuid, ''venta'', (v_item->>''cantidad'')::integer,
      ''Venta'', ''ventas'', v_venta_id
    );
  end loop;

  if p_medio_pago = ''mixto'' then
    for v_detalle in select * from jsonb_array_elements(p_detalles_pago)
    loop
      v_monto_mixto := (v_detalle->>''monto'')::numeric;
      v_medio_mixto := (v_detalle->>''medio'')::text::medio_pago;

      if v_monto_mixto > 0 then
        insert into caja_movimientos (
          sucursal_id, caja_id, tipo, monto, medio_pago, descripcion,
          referencia_tipo, referencia_id, usuario_id
        ) values (
          v_sucursal_id, v_caja_id, ''ingreso'', v_monto_mixto, v_medio_mixto,
          ''Venta mixta'', ''ventas'', v_venta_id, v_usuario_id
        );
        insert into pagos (
          sucursal_id, cliente_id, venta_id, caja_id, medio_pago, monto, usuario_id
        ) values (
          v_sucursal_id, p_cliente_id, v_venta_id, v_caja_id, v_medio_mixto, v_monto_mixto, v_usuario_id
        );
      end if;
    end loop;
  elsif p_medio_pago <> ''credito'' then
    insert into caja_movimientos (
      sucursal_id, caja_id, tipo, monto, medio_pago, descripcion,
      referencia_tipo, referencia_id, usuario_id
    ) values (
      v_sucursal_id, v_caja_id, ''ingreso'', v_total, p_medio_pago,
      ''Venta'', ''ventas'', v_venta_id, v_usuario_id
    );
    insert into pagos (
      sucursal_id, cliente_id, venta_id, caja_id, medio_pago, monto, usuario_id
    ) values (
      v_sucursal_id, p_cliente_id, v_venta_id, v_caja_id, p_medio_pago, v_total, v_usuario_id
    );
  else
    if p_cliente_id is null then raise exception ''Falta cliente para crédito''; end if;
    insert into creditos_cliente (
      sucursal_id, cliente_id, venta_id, monto_total, monto_pagado, saldo, estado
    ) values (
      v_sucursal_id, p_cliente_id, v_venta_id, v_total, 0, v_total, ''pendiente''
    );
  end if;

  return jsonb_build_object(''venta_id'', v_venta_id, ''total'', v_total, ''caja_id'', v_caja_id);
end;
$$;

-- ============================================================
-- 3.3 registrar_servicio: Medio de pago y crédito parcial
-- ============================================================
drop function if exists registrar_servicio(uuid, text, jsonb, integer, text, uuid, numeric);
create or replace function registrar_servicio(
  p_vehiculo_id    uuid,
  p_descripcion    text,
  p_items          jsonb,
  p_kilometraje    integer  default null,
  p_observaciones  text     default null,
  p_cliente_id     uuid     default null,
  p_monto_servicio numeric  default 0,
  p_medio_pago     medio_pago default ''efectivo'',
  p_monto_pagado   numeric  default null, -- Null significa pagar el total de inmediato
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
  
  -- Para mixto
  v_detalle     jsonb;
  v_suma_mixto  numeric := 0;
  v_monto_mixto numeric;
  v_medio_mixto medio_pago;
begin
  v_usuario_id  := current_usuario_id();
  v_sucursal_id := current_sucursal_id();

  if v_usuario_id is null then raise exception ''No autenticado''; end if;

  select id into v_caja_id from cajas
  where sucursal_id = v_sucursal_id and estado = ''abierta'' limit 1;

  if v_caja_id is null then raise exception ''No hay caja abierta''; end if;

  v_total := coalesce(p_monto_servicio, 0);

  insert into servicios (
    sucursal_id, vehiculo_id, cliente_id, usuario_id,
    kilometraje, descripcion, observaciones, estado,
    fecha_servicio, total, monto_servicio
  ) values (
    v_sucursal_id, p_vehiculo_id, p_cliente_id, v_usuario_id,
    p_kilometraje, p_descripcion, p_observaciones, ''terminado'',
    current_date, 0, coalesce(p_monto_servicio, 0)
  ) returning id into v_servicio_id;

  if p_items is not null and jsonb_array_length(p_items) > 0 then
    for v_item in select * from jsonb_array_elements(p_items)
    loop
      select precio_venta, costo into v_prod_precio, v_prod_costo
      from productos
      where id = (v_item->>''producto_id'')::uuid and sucursal_id = v_sucursal_id and activo = true;

      if not found then raise exception ''Producto % no encontrado'', v_item->>''producto_id''; end if;

      v_item_sub := coalesce((v_item->>''precio_unitario'')::numeric, v_prod_precio) * (v_item->>''cantidad'')::integer;
      v_total := v_total + v_item_sub;

      insert into servicio_productos (
        sucursal_id, servicio_id, producto_id, cantidad, precio_unitario, costo_unitario, subtotal
      ) values (
        v_sucursal_id, v_servicio_id, (v_item->>''producto_id'')::uuid, (v_item->>''cantidad'')::integer,
        coalesce((v_item->>''precio_unitario'')::numeric, v_prod_precio), coalesce(v_prod_costo, 0), v_item_sub
      );

      perform registrar_movimiento_stock(
        (v_item->>''producto_id'')::uuid, ''servicio'', (v_item->>''cantidad'')::integer,
        ''Servicio'', ''servicios'', v_servicio_id
      );
    end loop;
  end if;

  update servicios set total = v_total where id = v_servicio_id;

  -- Default to full amount if not specified and not purely credit
  if p_monto_pagado is null then
    if p_medio_pago = ''credito'' then
      p_monto_pagado := 0;
    else
      p_monto_pagado := v_total;
    end if;
  end if;

  -- Procesar pagos
  if p_medio_pago = ''mixto'' then
    if p_detalles_pago is null or jsonb_array_length(p_detalles_pago) = 0 then
      raise exception ''Debe especificar los detalles'';
    end if;
    for v_detalle in select * from jsonb_array_elements(p_detalles_pago)
    loop
      v_monto_mixto := (v_detalle->>''monto'')::numeric;
      v_medio_mixto := (v_detalle->>''medio'')::text::medio_pago;
      v_suma_mixto := v_suma_mixto + v_monto_mixto;

      if v_monto_mixto > 0 then
        insert into caja_movimientos (
          sucursal_id, caja_id, tipo, monto, medio_pago, descripcion, referencia_tipo, referencia_id, usuario_id
        ) values (
          v_sucursal_id, v_caja_id, ''ingreso'', v_monto_mixto, v_medio_mixto,
          ''Servicio: '' || p_descripcion, ''servicios'', v_servicio_id, v_usuario_id
        );
      end if;
    end loop;
    p_monto_pagado := v_suma_mixto;
  elsif p_medio_pago <> ''credito'' and p_monto_pagado > 0 then
    insert into caja_movimientos (
      sucursal_id, caja_id, tipo, monto, medio_pago, descripcion, referencia_tipo, referencia_id, usuario_id
    ) values (
      v_sucursal_id, v_caja_id, ''ingreso'', p_monto_pagado, p_medio_pago,
      ''Servicio: '' || p_descripcion, ''servicios'', v_servicio_id, v_usuario_id
    );
  end if;

  -- Crear crédito por la diferencia si no se paga todo
  if p_monto_pagado < v_total then
    if p_cliente_id is null then raise exception ''Falta cliente para crédito parcial''; end if;
    insert into creditos_cliente (
      sucursal_id, cliente_id, venta_id, -- Usamos nulo si es servicio, o podriamos enlazar el servicio
      monto_total, monto_pagado, saldo, estado
    ) values (
      v_sucursal_id, p_cliente_id, null, v_total, p_monto_pagado, v_total - p_monto_pagado, ''pendiente''
    );
  end if;

  return jsonb_build_object(
    ''servicio_id'', v_servicio_id, ''total'', v_total, ''caja_id'', v_caja_id
  );
end;
$$;

-- ============================================================
-- 3.4 anular_venta: manejo de caja cerrada
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
  v_caja_actual uuid;
  v_estado_caja text;
begin
  v_usuario_id  := current_usuario_id();
  v_sucursal_id := current_sucursal_id();

  if not is_admin_or_above() then raise exception ''Solo administradores pueden anular ventas''; end if;
  if trim(p_motivo) = '' then raise exception ''Falta motivo''; end if;

  select * into v_venta from ventas where id = p_venta_id and sucursal_id = v_sucursal_id for update;
  if not found then raise exception ''Venta no encontrada''; end if;
  if v_venta.estado = ''anulada'' then raise exception ''Ya está anulada''; end if;

  -- Stock
  for v_item in select * from venta_items where venta_id = p_venta_id loop
    if v_item.producto_id is not null then
      perform registrar_movimiento_stock(
        v_item.producto_id, ''devolucion'', v_item.cantidad,
        ''Anulación: '' || p_motivo, ''ventas'', p_venta_id
      );
    end if;
  end loop;

  -- Caja (si la original esta cerrada, usa la abierta)
  if v_venta.medio_pago <> ''credito'' and v_venta.caja_id is not null then
    select estado into v_estado_caja from cajas where id = v_venta.caja_id;
    if v_estado_caja = ''abierta'' then
      v_caja_actual := v_venta.caja_id;
    else
      select id into v_caja_actual from cajas where sucursal_id = v_sucursal_id and estado = ''abierta'' limit 1;
      if v_caja_actual is null then raise exception ''No hay caja abierta para hacer el egreso de anulación''; end if;
    end if;

    insert into caja_movimientos (
      sucursal_id, caja_id, tipo, monto, medio_pago, descripcion, referencia_tipo, referencia_id, usuario_id
    ) values (
      v_sucursal_id, v_caja_actual, ''egreso'', v_venta.total, v_venta.medio_pago,
      ''Anulación: '' || p_motivo, ''ventas'', p_venta_id, v_usuario_id
    );
  end if;

  -- Credito
  if v_venta.medio_pago = ''credito'' then
    update creditos_cliente set estado = ''pagado'' where venta_id = p_venta_id;
  end if;

  update ventas set estado = ''anulada'', updated_at = now() where id = p_venta_id;

  return jsonb_build_object(''venta_id'', p_venta_id, ''estado'', ''anulada'');
end;
$$;

-- ============================================================
-- 3.5 anular_pago_credito
-- ============================================================
create or replace function anular_pago_credito(
  p_pago_id uuid,
  p_motivo text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id  uuid;
  v_sucursal_id uuid;
  v_caja_actual uuid;
  v_pago        pagos;
  v_credito     creditos_cliente;
begin
  v_usuario_id  := current_usuario_id();
  v_sucursal_id := current_sucursal_id();

  if not is_admin_or_above() then raise exception ''No autorizado''; end if;

  select * into v_pago from pagos where id = p_pago_id and sucursal_id = v_sucursal_id;
  if not found then raise exception ''Pago no encontrado''; end if;

  -- Buscar credito asocidado al venta_id del pago
  if v_pago.venta_id is not null then
    select * into v_credito from creditos_cliente where venta_id = v_pago.venta_id and sucursal_id = v_sucursal_id limit 1;
  else
    -- Si no hay venta_id, podria estar vinculado al cliente, pero no tenemos certeza absoluta sin credito_id
    -- Para este MVP asumimos que los creditos nacen de ventas
    raise exception ''No se puede identificar el credito asociado al pago'';
  end if;

  if v_credito is null then raise exception ''Crédito no encontrado''; end if;

  select id into v_caja_actual from cajas where sucursal_id = v_sucursal_id and estado = ''abierta'' limit 1;
  if v_caja_actual is null then raise exception ''No hay caja abierta para hacer el egreso''; end if;

  insert into caja_movimientos (
    sucursal_id, caja_id, tipo, monto, medio_pago, descripcion, referencia_tipo, referencia_id, usuario_id
  ) values (
    v_sucursal_id, v_caja_actual, ''egreso'', v_pago.monto, v_pago.medio_pago,
    ''Anulación de pago de crédito: '' || p_motivo, ''pagos'', p_pago_id, v_usuario_id
  );

  update creditos_cliente 
  set monto_pagado = monto_pagado - v_pago.monto,
      saldo = saldo + v_pago.monto,
      estado = case when (saldo + v_pago.monto) > 0 then ''pendiente''::estado_credito else ''pagado''::estado_credito end
  where id = v_credito.id;

  delete from pagos where id = p_pago_id;

  return jsonb_build_object(''status'', ''ok'');
end;
$$;
