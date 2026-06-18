-- 012_servicio_registra_en_caja.sql
-- Registra servicios en caja_movimientos para que cerrar_caja
-- los incluya en el cálculo del monto esperado.
-- Requiere haber aplicado 011_servicio_monto_servicio.sql
-- Aplicar en: Supabase Dashboard > SQL Editor

create or replace function registrar_servicio(
  p_vehiculo_id    uuid,
  p_descripcion    text,
  p_items          jsonb,
  p_kilometraje    integer  default null,
  p_observaciones  text     default null,
  p_cliente_id     uuid     default null,
  p_monto_servicio numeric  default 0
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
  v_item_sub    numeric;
begin
  v_usuario_id  := current_usuario_id();
  v_sucursal_id := current_sucursal_id();

  if v_usuario_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  v_total := coalesce(p_monto_servicio, 0);

  insert into servicios (
    sucursal_id, vehiculo_id, cliente_id, usuario_id,
    kilometraje, descripcion, observaciones, estado,
    fecha_servicio, total, monto_servicio
  ) values (
    v_sucursal_id, p_vehiculo_id, p_cliente_id, v_usuario_id,
    p_kilometraje, p_descripcion, p_observaciones, 'terminado',
    current_date, 0, coalesce(p_monto_servicio, 0)
  )
  returning id into v_servicio_id;

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

  update servicios set total = v_total where id = v_servicio_id;

  -- Registrar en caja_movimientos si hay caja abierta y el total > 0
  select id into v_caja_id
  from cajas
  where sucursal_id = v_sucursal_id
    and estado = 'abierta'
  limit 1;

  if v_caja_id is not null and v_total > 0 then
    insert into caja_movimientos (
      sucursal_id, caja_id, tipo, monto, medio_pago, descripcion,
      referencia_tipo, referencia_id, usuario_id
    ) values (
      v_sucursal_id, v_caja_id, 'ingreso', v_total, 'efectivo',
      'Servicio: ' || p_descripcion,
      'servicios', v_servicio_id, v_usuario_id
    );
  end if;

  return jsonb_build_object(
    'servicio_id',   v_servicio_id,
    'total',         v_total,
    'monto_servicio', coalesce(p_monto_servicio, 0),
    'caja_id',       v_caja_id
  );
end;
$$;
