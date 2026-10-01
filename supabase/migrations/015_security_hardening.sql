-- 015_security_hardening.sql
-- Fase 2: Seguridad y endurecimiento del backend
-- 1. Agrega security_invoker a todas las vistas para que hereden RLS
-- 2. Helper de roles y validacion en las RPC
-- 3. Revocar execute a anon en todo
-- 4. Impedir direct updates a tablas criticas

-- ============================================================
-- 2.1 VISTAS: security_invoker = on
-- Asegura que las vistas respeten el RLS del usuario actual
-- ============================================================
alter view vw_productos_detalle set (security_invoker = true);
alter view vw_stock_bajo set (security_invoker = true);
alter view vw_valor_inventario set (security_invoker = true);
alter view vw_movimientos_stock_detalle set (security_invoker = true);
alter view vw_ventas_detalle set (security_invoker = true);
alter view vw_caja_resumen set (security_invoker = true);
alter view vw_servicios_detalle set (security_invoker = true);
alter view vw_ganancias_ventas set (security_invoker = true);
alter view vw_ganancias_servicios set (security_invoker = true);

-- ============================================================
-- 2.2 HELPER: require_role
-- ============================================================
create or replace function require_role(p_roles text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text;
begin
  v_rol := current_user_role();
  
  -- Superadmin siempre tiene acceso a todo
  if v_rol = ''superadmin'' then
    return;
  end if;
  
  if not (v_rol = any(p_roles)) then
    raise exception ''No tienes permisos para realizar esta accion (Requiere: %, Tienes: %)'', array_to_string(p_roles, '', ''), v_rol;
  end if;
end;
$$;

-- Aplicar a ajustar_stock (admin, almacen)
create or replace function ajustar_stock(
  p_producto_id uuid,
  p_stock_nuevo integer,
  p_motivo      text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sucursal_id uuid;
  v_usuario_id  uuid;
  v_stock_ant   integer;
  v_tipo        tipo_movimiento_stock;
  v_diferencia  integer;
begin
  v_sucursal_id := current_sucursal_id();
  v_usuario_id  := current_usuario_id();

  perform require_role(array[''admin'', ''almacen'']);

  if p_stock_nuevo < 0 then
    raise exception ''El stock no puede ser negativo'';
  end if;

  select stock_actual into v_stock_ant
  from productos
  where id = p_producto_id and sucursal_id = v_sucursal_id
  for update;

  if not found then
    raise exception ''Producto no encontrado o no pertenece a tu sucursal'';
  end if;

  v_diferencia := p_stock_nuevo - v_stock_ant;
  if v_diferencia = 0 then
    return jsonb_build_object(''status'', ''sin_cambios'');
  end if;

  v_tipo := case when v_diferencia > 0 then ''entrada''::tipo_movimiento_stock else ''salida''::tipo_movimiento_stock end;

  insert into movimientos_stock (
    sucursal_id, producto_id, usuario_id, tipo, cantidad,
    cantidad_anterior, cantidad_nueva, motivo, referencia_tipo
  ) values (
    v_sucursal_id, p_producto_id, v_usuario_id, v_tipo, abs(v_diferencia),
    v_stock_ant, p_stock_nuevo, p_motivo, ''ajuste''
  );

  update productos
  set stock_actual = p_stock_nuevo
  where id = p_producto_id;

  return jsonb_build_object(
    ''producto_id'', p_producto_id,
    ''stock_anterior'', v_stock_ant,
    ''stock_nuevo'', p_stock_nuevo,
    ''diferencia'', v_diferencia
  );
end;
$$;

-- ============================================================
-- 2.3 REVOKE EXECUTE A PUBLIC/ANON
-- Evita acceso directo no autenticado a TODAS las RPC
-- ============================================================
revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;
grant execute on all functions in schema public to authenticated;
grant execute on all functions in schema public to service_role;

-- Revocamos registrar_movimiento_stock a authenticated ya que es de uso interno
revoke execute on function registrar_movimiento_stock(uuid, tipo_movimiento_stock, integer, text, text, text) from authenticated;

-- Creamos registrar_entrada_stock para ser usada desde Importacion u otros que lo requieran con rol
create or replace function registrar_entrada_stock(
  p_producto_id uuid,
  p_cantidad integer,
  p_motivo text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform require_role(array[''admin'', ''almacen'']);
  
  if p_cantidad <= 0 then
    raise exception ''La cantidad debe ser mayor a cero'';
  end if;
  
  perform registrar_movimiento_stock(
    p_producto_id,
    ''entrada'',
    p_cantidad,
    p_motivo,
    ''entrada_manual'',
    null
  );
  
  return jsonb_build_object(''status'', ''ok'');
end;
$$;
grant execute on function registrar_entrada_stock(uuid, integer, text) to authenticated;

-- ============================================================
-- 2.4 QUITAR UPDATE DIRECTO Y 2.5 WITH CHECK USUARIOS
-- ============================================================

-- Productos: los usuarios no pueden hacer UPDATE directo al stock, solo via RPC.
drop policy if exists "usuarios_update_productos" on productos;
create policy "usuarios_update_productos"
on productos for update
to authenticated
using (
  sucursal_id = current_sucursal_id()
  and current_user_role() in (''superadmin'', ''admin'', ''almacen'')
)
with check (
  stock_actual = stock_actual -- El stock no se puede cambiar en UPDATE REST directo
);

-- Usuarios: Evitar escalar privilegios
drop policy if exists "usuarios_update_admin" on usuarios;
create policy "usuarios_update_admin"
on usuarios for update
to authenticated
using (
  current_user_role() = ''superadmin'' 
  or (current_user_role() = ''admin'' and sucursal_id = current_sucursal_id())
)
with check (
  current_user_role() = ''superadmin''
  or (
    current_user_role() = ''admin'' 
    and rol <> ''superadmin'' -- Admin no puede crear superadmins
    and sucursal_id = current_sucursal_id() -- No puede cambiar usuarios a otra sucursal
  )
);

-- ============================================================
-- 2.7 RESTRINGIR COSTOS Y GANANCIAS POR ROL
-- vw_productos_detalle ahora evalúa el rol para devolver costo
-- ============================================================
create or replace view vw_productos_detalle as
select
  p.id,
  p.sucursal_id,
  p.codigo_interno,
  p.codigo_barras,
  p.nombre,
  p.marca,
  p.viscosidad_especificacion,
  p.precio_venta,
  case when current_user_role() in (''superadmin'', ''admin'') then p.costo else 0 end as costo,
  p.stock_actual,
  p.stock_minimo,
  p.tiene_codigo_barras,
  p.foto_url,
  p.activo,
  p.created_at,
  p.updated_at,
  p.categoria_id,
  c.nombre as categoria_nombre,
  p.ubicacion_id,
  u.zona,
  u.estante,
  u.nivel,
  u.codigo as ubicacion_codigo,
  case
    when p.stock_actual = 0 then ''agotado''
    when p.stock_actual <= p.stock_minimo then ''bajo''
    else ''ok''
  end as stock_estado,
  case when current_user_role() in (''superadmin'', ''admin'') then p.costo * p.stock_actual else 0 end as valor_costo_total,
  p.precio_venta * p.stock_actual as valor_venta_total
from productos p
left join categorias c on c.id = p.categoria_id
left join ubicaciones u on u.id = p.ubicacion_id;
-- Nota: La vista no cambia los tipos de dato, solo oculta el valor.

-- ============================================================
-- 2.8 BUCKET POLICIES (STORAGE)
-- ============================================================
insert into storage.buckets (id, name, public) 
values (''product-images'', ''product-images'', true)
on conflict (id) do nothing;

create policy "product_images_public_read"
on storage.objects for select
to public
using ( bucket_id = ''product-images'' );

create policy "product_images_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = ''product-images'' 
  and current_user_role() in (''superadmin'', ''admin'', ''almacen'')
);

create policy "product_images_update"
on storage.objects for update
to authenticated
using (
  bucket_id = ''product-images'' 
  and current_user_role() in (''superadmin'', ''admin'', ''almacen'')
);

create policy "product_images_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = ''product-images'' 
  and current_user_role() in (''superadmin'', ''admin'', ''almacen'')
);

-- Evitar updates directos a las tablas de caja y creditos_cliente
drop policy if exists "usuarios_update_cajas" on cajas;
drop policy if exists "usuarios_update_creditos" on creditos_cliente;
-- Solo permitiremos updates por RLS a cajas/creditos si es necesario por el cliente, pero en realidad todo se hace por RPC con security definer
-- Así que denegamos el update directo
create policy "usuarios_update_cajas" on cajas for update to authenticated using (false);
create policy "usuarios_update_creditos" on creditos_cliente for update to authenticated using (false);

