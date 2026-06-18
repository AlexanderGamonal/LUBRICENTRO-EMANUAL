-- 010_fix_registrar_servicio_estado.sql
-- Corrige el estado inicial de servicios: 'pendiente' → 'terminado'
-- Aplicar en: Supabase Dashboard > SQL Editor

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

  -- Insertar servicio con estado 'terminado' (la atención ya se realizó)
  insert into servicios (
    sucursal_id, vehiculo_id, cliente_id, usuario_id,
    kilometraje, descripcion, observaciones, estado, fecha_servicio, total
  ) values (
    v_sucursal_id, p_vehiculo_id, p_cliente_id, v_usuario_id,
    p_kilometraje, p_descripcion, p_observaciones, 'terminado', current_date, 0
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

-- Corregir atenciones ya registradas que quedaron en 'pendiente'
update servicios set estado = 'terminado' where estado = 'pendiente';
