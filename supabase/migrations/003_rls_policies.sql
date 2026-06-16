-- 003_rls_policies.sql
-- Row Level Security: habilitar RLS y definir políticas por tabla

-- ============================================================
-- FUNCIONES HELPER (SECURITY DEFINER para evitar recursión RLS)
-- ============================================================
create or replace function current_usuario_id()
returns uuid as $$
  select id from usuarios where auth_user_id = auth.uid() and activo = true limit 1;
$$ language sql stable security definer set search_path = public;

create or replace function current_sucursal_id()
returns uuid as $$
  select sucursal_id from usuarios where auth_user_id = auth.uid() and activo = true limit 1;
$$ language sql stable security definer set search_path = public;

create or replace function current_user_role()
returns text as $$
  select rol::text from usuarios where auth_user_id = auth.uid() and activo = true limit 1;
$$ language sql stable security definer set search_path = public;

create or replace function is_admin_or_above()
returns boolean as $$
  select current_user_role() in ('admin', 'superadmin');
$$ language sql stable security definer set search_path = public;

-- ============================================================
-- HABILITAR RLS EN TODAS LAS TABLAS
-- ============================================================
alter table sucursales        enable row level security;
alter table usuarios          enable row level security;
alter table categorias        enable row level security;
alter table ubicaciones       enable row level security;
alter table productos         enable row level security;
alter table movimientos_stock enable row level security;
alter table clientes          enable row level security;
alter table vehiculos         enable row level security;
alter table servicios         enable row level security;
alter table servicio_productos enable row level security;
alter table ventas            enable row level security;
alter table venta_items       enable row level security;
alter table cajas             enable row level security;
alter table caja_movimientos  enable row level security;
alter table pagos             enable row level security;
alter table creditos_cliente  enable row level security;
alter table auditoria_eventos enable row level security;

-- ============================================================
-- SUCURSALES
-- ============================================================
create policy "sucursales_select" on sucursales
  for select to authenticated
  using (id = current_sucursal_id() or current_user_role() = 'superadmin');

create policy "sucursales_update_admin" on sucursales
  for update to authenticated
  using (id = current_sucursal_id() and is_admin_or_above());

-- ============================================================
-- USUARIOS
-- ============================================================
create policy "usuarios_select" on usuarios
  for select to authenticated
  using (sucursal_id = current_sucursal_id() or current_user_role() = 'superadmin');

create policy "usuarios_insert_admin" on usuarios
  for insert to authenticated
  with check (sucursal_id = current_sucursal_id() and is_admin_or_above());

create policy "usuarios_update_admin" on usuarios
  for update to authenticated
  using (sucursal_id = current_sucursal_id() and is_admin_or_above());

create policy "usuarios_delete_admin" on usuarios
  for delete to authenticated
  using (sucursal_id = current_sucursal_id() and is_admin_or_above());

-- ============================================================
-- CATEGORIAS
-- ============================================================
create policy "categorias_select" on categorias
  for select to authenticated
  using (sucursal_id = current_sucursal_id());

create policy "categorias_insert" on categorias
  for insert to authenticated
  with check (sucursal_id = current_sucursal_id() and current_user_role() in ('admin', 'superadmin', 'almacen'));

create policy "categorias_update" on categorias
  for update to authenticated
  using (sucursal_id = current_sucursal_id() and current_user_role() in ('admin', 'superadmin', 'almacen'));

create policy "categorias_delete_admin" on categorias
  for delete to authenticated
  using (sucursal_id = current_sucursal_id() and is_admin_or_above());

-- ============================================================
-- UBICACIONES
-- ============================================================
create policy "ubicaciones_select" on ubicaciones
  for select to authenticated
  using (sucursal_id = current_sucursal_id());

create policy "ubicaciones_insert" on ubicaciones
  for insert to authenticated
  with check (sucursal_id = current_sucursal_id() and current_user_role() in ('admin', 'superadmin', 'almacen'));

create policy "ubicaciones_update" on ubicaciones
  for update to authenticated
  using (sucursal_id = current_sucursal_id() and current_user_role() in ('admin', 'superadmin', 'almacen'));

create policy "ubicaciones_delete_admin" on ubicaciones
  for delete to authenticated
  using (sucursal_id = current_sucursal_id() and is_admin_or_above());

-- ============================================================
-- PRODUCTOS
-- Nota: UPDATE de stock_actual solo vía RPC (no hay policy directa de update para stock)
-- ============================================================
create policy "productos_select" on productos
  for select to authenticated
  using (sucursal_id = current_sucursal_id());

create policy "productos_insert" on productos
  for insert to authenticated
  with check (sucursal_id = current_sucursal_id() and current_user_role() in ('admin', 'superadmin', 'almacen'));

create policy "productos_update" on productos
  for update to authenticated
  using (sucursal_id = current_sucursal_id() and current_user_role() in ('admin', 'superadmin', 'almacen'));

create policy "productos_delete_admin" on productos
  for delete to authenticated
  using (sucursal_id = current_sucursal_id() and is_admin_or_above());

-- ============================================================
-- MOVIMIENTOS_STOCK (solo lectura desde el frontend; escritura solo vía RPC)
-- ============================================================
create policy "movimientos_select" on movimientos_stock
  for select to authenticated
  using (sucursal_id = current_sucursal_id());

-- Las funciones RPC con SECURITY DEFINER pueden insertar aunque no haya policy de INSERT para el rol

-- ============================================================
-- CLIENTES
-- ============================================================
create policy "clientes_select" on clientes
  for select to authenticated
  using (sucursal_id = current_sucursal_id());

create policy "clientes_insert" on clientes
  for insert to authenticated
  with check (sucursal_id = current_sucursal_id());

create policy "clientes_update" on clientes
  for update to authenticated
  using (sucursal_id = current_sucursal_id());

create policy "clientes_delete_admin" on clientes
  for delete to authenticated
  using (sucursal_id = current_sucursal_id() and is_admin_or_above());

-- ============================================================
-- VEHICULOS
-- ============================================================
create policy "vehiculos_select" on vehiculos
  for select to authenticated
  using (sucursal_id = current_sucursal_id());

create policy "vehiculos_insert" on vehiculos
  for insert to authenticated
  with check (sucursal_id = current_sucursal_id());

create policy "vehiculos_update" on vehiculos
  for update to authenticated
  using (sucursal_id = current_sucursal_id());

create policy "vehiculos_delete_admin" on vehiculos
  for delete to authenticated
  using (sucursal_id = current_sucursal_id() and is_admin_or_above());

-- ============================================================
-- CAJAS
-- ============================================================
create policy "cajas_select" on cajas
  for select to authenticated
  using (sucursal_id = current_sucursal_id());

create policy "cajas_insert" on cajas
  for insert to authenticated
  with check (sucursal_id = current_sucursal_id() and current_user_role() in ('admin', 'superadmin', 'vendedor'));

create policy "cajas_update" on cajas
  for update to authenticated
  using (sucursal_id = current_sucursal_id() and current_user_role() in ('admin', 'superadmin', 'vendedor'));

-- ============================================================
-- VENTAS
-- ============================================================
create policy "ventas_select" on ventas
  for select to authenticated
  using (sucursal_id = current_sucursal_id());

create policy "ventas_insert" on ventas
  for insert to authenticated
  with check (sucursal_id = current_sucursal_id() and current_user_role() in ('admin', 'superadmin', 'vendedor'));

create policy "ventas_update_admin" on ventas
  for update to authenticated
  using (sucursal_id = current_sucursal_id() and is_admin_or_above());

-- ============================================================
-- VENTA_ITEMS
-- ============================================================
create policy "venta_items_select" on venta_items
  for select to authenticated
  using (sucursal_id = current_sucursal_id());

create policy "venta_items_insert" on venta_items
  for insert to authenticated
  with check (sucursal_id = current_sucursal_id() and current_user_role() in ('admin', 'superadmin', 'vendedor'));

-- ============================================================
-- SERVICIOS
-- ============================================================
create policy "servicios_select" on servicios
  for select to authenticated
  using (sucursal_id = current_sucursal_id());

create policy "servicios_insert" on servicios
  for insert to authenticated
  with check (sucursal_id = current_sucursal_id());

create policy "servicios_update" on servicios
  for update to authenticated
  using (sucursal_id = current_sucursal_id());

-- ============================================================
-- SERVICIO_PRODUCTOS
-- ============================================================
create policy "servicio_productos_select" on servicio_productos
  for select to authenticated
  using (sucursal_id = current_sucursal_id());

create policy "servicio_productos_insert" on servicio_productos
  for insert to authenticated
  with check (sucursal_id = current_sucursal_id());

-- ============================================================
-- CAJA_MOVIMIENTOS
-- ============================================================
create policy "caja_movimientos_select" on caja_movimientos
  for select to authenticated
  using (sucursal_id = current_sucursal_id());

create policy "caja_movimientos_insert" on caja_movimientos
  for insert to authenticated
  with check (sucursal_id = current_sucursal_id() and current_user_role() in ('admin', 'superadmin', 'vendedor'));

-- ============================================================
-- PAGOS
-- ============================================================
create policy "pagos_select" on pagos
  for select to authenticated
  using (sucursal_id = current_sucursal_id());

create policy "pagos_insert" on pagos
  for insert to authenticated
  with check (sucursal_id = current_sucursal_id() and current_user_role() in ('admin', 'superadmin', 'vendedor'));

-- ============================================================
-- CREDITOS_CLIENTE
-- ============================================================
create policy "creditos_select" on creditos_cliente
  for select to authenticated
  using (sucursal_id = current_sucursal_id());

create policy "creditos_insert" on creditos_cliente
  for insert to authenticated
  with check (sucursal_id = current_sucursal_id() and current_user_role() in ('admin', 'superadmin', 'vendedor'));

create policy "creditos_update" on creditos_cliente
  for update to authenticated
  using (sucursal_id = current_sucursal_id() and current_user_role() in ('admin', 'superadmin', 'vendedor'));

-- ============================================================
-- AUDITORIA_EVENTOS (solo lectura para admins)
-- ============================================================
create policy "auditoria_select_admin" on auditoria_eventos
  for select to authenticated
  using (sucursal_id = current_sucursal_id() and is_admin_or_above());
