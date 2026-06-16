-- 002_schema_base.sql
-- Esquema base: tablas, constraints, índices y triggers

-- ============================================================
-- FUNCIÓN COMPARTIDA: actualizar updated_at automáticamente
-- ============================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================
-- TIPOS ENUMERADOS
-- ============================================================
create type rol_usuario as enum ('superadmin', 'admin', 'vendedor', 'almacen');
create type tipo_movimiento_stock as enum ('entrada', 'salida', 'ajuste', 'perdida', 'devolucion', 'venta', 'servicio');
create type tipo_cliente as enum ('natural', 'empresa');
create type estado_servicio as enum ('pendiente', 'terminado', 'anulado');
create type estado_venta as enum ('emitida', 'anulada');
create type medio_pago as enum ('efectivo', 'yape', 'plin', 'tarjeta', 'transferencia', 'credito', 'mixto');
create type estado_caja as enum ('abierta', 'cerrada');
create type tipo_caja_movimiento as enum ('ingreso', 'egreso');
create type estado_credito as enum ('pendiente', 'parcial', 'pagado', 'vencido');

-- ============================================================
-- TABLA: sucursales
-- ============================================================
create table sucursales (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  direccion   text,
  telefono    text,
  activa      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_sucursales_updated_at
  before update on sucursales
  for each row execute function set_updated_at();

-- ============================================================
-- TABLA: usuarios
-- ============================================================
create table usuarios (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid unique references auth.users(id) on delete set null,
  sucursal_id   uuid not null references sucursales(id),
  nombre        text not null,
  email         text,
  rol           rol_usuario not null default 'vendedor',
  activo        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_usuarios_auth_user_id on usuarios(auth_user_id);
create index idx_usuarios_sucursal_id on usuarios(sucursal_id);

create trigger trg_usuarios_updated_at
  before update on usuarios
  for each row execute function set_updated_at();

-- ============================================================
-- TABLA: categorias
-- ============================================================
create table categorias (
  id          uuid primary key default gen_random_uuid(),
  sucursal_id uuid not null references sucursales(id),
  nombre      text not null,
  descripcion text,
  activa      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (sucursal_id, nombre)
);

create trigger trg_categorias_updated_at
  before update on categorias
  for each row execute function set_updated_at();

-- ============================================================
-- TABLA: ubicaciones
-- ============================================================
create table ubicaciones (
  id          uuid primary key default gen_random_uuid(),
  sucursal_id uuid not null references sucursales(id),
  zona        char(1) not null check (zona in ('A','B','C','D','E','F','G','H')),
  estante     smallint not null check (estante > 0),
  nivel       smallint not null check (nivel > 0),
  codigo      text generated always as (zona || '-' || estante::text || '-' || nivel::text) stored,
  descripcion text,
  activa      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (sucursal_id, zona, estante, nivel)
);

create index idx_ubicaciones_sucursal_id on ubicaciones(sucursal_id);
create index idx_ubicaciones_codigo on ubicaciones(sucursal_id, codigo);

create trigger trg_ubicaciones_updated_at
  before update on ubicaciones
  for each row execute function set_updated_at();

-- ============================================================
-- TABLA: productos
-- ============================================================
create table productos (
  id                       uuid primary key default gen_random_uuid(),
  sucursal_id              uuid not null references sucursales(id),
  categoria_id             uuid references categorias(id) on delete set null,
  ubicacion_id             uuid references ubicaciones(id) on delete set null,
  codigo_interno           text not null,
  codigo_barras            text,
  nombre                   text not null,
  marca                    text,
  viscosidad_especificacion text,
  precio_venta             numeric(10,2) not null default 0 check (precio_venta >= 0),
  costo                    numeric(10,2) not null default 0 check (costo >= 0),
  stock_actual             integer not null default 0 check (stock_actual >= 0),
  stock_minimo             integer not null default 0 check (stock_minimo >= 0),
  tiene_codigo_barras      boolean not null default false,
  foto_url                 text,
  activo                   boolean not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (sucursal_id, codigo_interno)
);

-- Unicidad de código de barras por sucursal (solo cuando no está vacío)
create unique index idx_productos_codigo_barras_unique
  on productos (sucursal_id, codigo_barras)
  where codigo_barras is not null and codigo_barras <> '';

create index idx_productos_codigo_interno on productos(sucursal_id, codigo_interno);
create index idx_productos_nombre_trgm on productos using gin(to_tsvector('spanish', nombre));
create index idx_productos_sucursal_id on productos(sucursal_id);
create index idx_productos_activo on productos(sucursal_id, activo);

create trigger trg_productos_updated_at
  before update on productos
  for each row execute function set_updated_at();

-- ============================================================
-- TABLA: movimientos_stock
-- ============================================================
create table movimientos_stock (
  id               uuid primary key default gen_random_uuid(),
  sucursal_id      uuid not null references sucursales(id),
  producto_id      uuid not null references productos(id),
  usuario_id       uuid references usuarios(id) on delete set null,
  tipo             tipo_movimiento_stock not null,
  cantidad         integer not null check (cantidad <> 0),
  cantidad_anterior integer not null check (cantidad_anterior >= 0),
  cantidad_nueva   integer not null check (cantidad_nueva >= 0),
  motivo           text,
  referencia_tipo  text,
  referencia_id    uuid,
  created_at       timestamptz not null default now()
);

create index idx_movimientos_stock_producto_id on movimientos_stock(producto_id, created_at desc);
create index idx_movimientos_stock_sucursal_id on movimientos_stock(sucursal_id, created_at desc);

-- ============================================================
-- TABLA: clientes
-- ============================================================
create table clientes (
  id          uuid primary key default gen_random_uuid(),
  sucursal_id uuid not null references sucursales(id),
  nombre      text not null,
  telefono    text,
  email       text,
  tipo        tipo_cliente not null default 'natural',
  ruc_dni     text,
  direccion   text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_clientes_telefono on clientes(sucursal_id, telefono);
create index idx_clientes_ruc_dni on clientes(sucursal_id, ruc_dni);

create trigger trg_clientes_updated_at
  before update on clientes
  for each row execute function set_updated_at();

-- ============================================================
-- TABLA: vehiculos
-- ============================================================
create table vehiculos (
  id             uuid primary key default gen_random_uuid(),
  sucursal_id    uuid not null references sucursales(id),
  cliente_id     uuid references clientes(id) on delete set null,
  placa          text not null,
  marca_vehiculo text,
  modelo         text,
  anio           smallint check (anio > 1900 and anio <= 2100),
  color          text,
  activo         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (sucursal_id, placa)
);

create index idx_vehiculos_placa on vehiculos(sucursal_id, placa);
create index idx_vehiculos_cliente_id on vehiculos(cliente_id);

create trigger trg_vehiculos_updated_at
  before update on vehiculos
  for each row execute function set_updated_at();

-- ============================================================
-- TABLA: cajas
-- ============================================================
create table cajas (
  id                    uuid primary key default gen_random_uuid(),
  sucursal_id           uuid not null references sucursales(id),
  usuario_id            uuid not null references usuarios(id),
  fecha                 date not null default current_date,
  monto_apertura        numeric(10,2) not null default 0 check (monto_apertura >= 0),
  monto_cierre_esperado numeric(10,2) check (monto_cierre_esperado >= 0),
  monto_cierre_real     numeric(10,2) check (monto_cierre_real >= 0),
  diferencia            numeric(10,2),
  estado                estado_caja not null default 'abierta',
  observaciones         text,
  opened_at             timestamptz not null default now(),
  closed_at             timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index idx_cajas_sucursal_estado on cajas(sucursal_id, estado);

create trigger trg_cajas_updated_at
  before update on cajas
  for each row execute function set_updated_at();

-- ============================================================
-- TABLA: ventas
-- ============================================================
create table ventas (
  id            uuid primary key default gen_random_uuid(),
  sucursal_id   uuid not null references sucursales(id),
  usuario_id    uuid not null references usuarios(id),
  cliente_id    uuid references clientes(id) on delete set null,
  caja_id       uuid references cajas(id) on delete set null,
  subtotal      numeric(10,2) not null default 0 check (subtotal >= 0),
  descuento     numeric(10,2) not null default 0 check (descuento >= 0),
  total         numeric(10,2) not null default 0 check (total >= 0),
  medio_pago    medio_pago not null default 'efectivo',
  estado        estado_venta not null default 'emitida',
  observaciones text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_ventas_sucursal_id on ventas(sucursal_id, created_at desc);
create index idx_ventas_cliente_id on ventas(cliente_id);
create index idx_ventas_caja_id on ventas(caja_id);

create trigger trg_ventas_updated_at
  before update on ventas
  for each row execute function set_updated_at();

-- ============================================================
-- TABLA: venta_items
-- ============================================================
create table venta_items (
  id              uuid primary key default gen_random_uuid(),
  sucursal_id     uuid not null references sucursales(id),
  venta_id        uuid not null references ventas(id) on delete cascade,
  producto_id     uuid references productos(id) on delete set null,
  cantidad        integer not null check (cantidad > 0),
  precio_unitario numeric(10,2) not null check (precio_unitario >= 0),
  subtotal        numeric(10,2) not null check (subtotal >= 0),
  created_at      timestamptz not null default now()
);

create index idx_venta_items_venta_id on venta_items(venta_id);

-- ============================================================
-- TABLA: servicios
-- ============================================================
create table servicios (
  id             uuid primary key default gen_random_uuid(),
  sucursal_id    uuid not null references sucursales(id),
  vehiculo_id    uuid references vehiculos(id) on delete set null,
  cliente_id     uuid references clientes(id) on delete set null,
  usuario_id     uuid not null references usuarios(id),
  kilometraje    integer check (kilometraje >= 0),
  descripcion    text not null,
  observaciones  text,
  estado         estado_servicio not null default 'pendiente',
  fecha_servicio date not null default current_date,
  total          numeric(10,2) not null default 0 check (total >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index idx_servicios_sucursal_id on servicios(sucursal_id, fecha_servicio desc);
create index idx_servicios_vehiculo_id on servicios(vehiculo_id);

create trigger trg_servicios_updated_at
  before update on servicios
  for each row execute function set_updated_at();

-- ============================================================
-- TABLA: servicio_productos
-- ============================================================
create table servicio_productos (
  id              uuid primary key default gen_random_uuid(),
  sucursal_id     uuid not null references sucursales(id),
  servicio_id     uuid not null references servicios(id) on delete cascade,
  producto_id     uuid not null references productos(id),
  cantidad        integer not null check (cantidad > 0),
  precio_unitario numeric(10,2) not null check (precio_unitario >= 0),
  subtotal        numeric(10,2) not null check (subtotal >= 0),
  created_at      timestamptz not null default now()
);

create index idx_servicio_productos_servicio_id on servicio_productos(servicio_id);

-- ============================================================
-- TABLA: caja_movimientos
-- ============================================================
create table caja_movimientos (
  id              uuid primary key default gen_random_uuid(),
  sucursal_id     uuid not null references sucursales(id),
  caja_id         uuid not null references cajas(id),
  tipo            tipo_caja_movimiento not null,
  monto           numeric(10,2) not null check (monto > 0),
  medio_pago      medio_pago not null default 'efectivo',
  descripcion     text,
  referencia_tipo text,
  referencia_id   uuid,
  usuario_id      uuid references usuarios(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index idx_caja_movimientos_caja_id on caja_movimientos(caja_id);

-- ============================================================
-- TABLA: pagos
-- ============================================================
create table pagos (
  id          uuid primary key default gen_random_uuid(),
  sucursal_id uuid not null references sucursales(id),
  cliente_id  uuid references clientes(id) on delete set null,
  venta_id    uuid references ventas(id) on delete set null,
  caja_id     uuid references cajas(id) on delete set null,
  medio_pago  medio_pago not null,
  monto       numeric(10,2) not null check (monto > 0),
  referencia  text,
  usuario_id  uuid references usuarios(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index idx_pagos_venta_id on pagos(venta_id);
create index idx_pagos_cliente_id on pagos(cliente_id);

-- ============================================================
-- TABLA: creditos_cliente
-- ============================================================
create table creditos_cliente (
  id                uuid primary key default gen_random_uuid(),
  sucursal_id       uuid not null references sucursales(id),
  cliente_id        uuid not null references clientes(id),
  venta_id          uuid references ventas(id) on delete set null,
  monto_total       numeric(10,2) not null check (monto_total > 0),
  monto_pagado      numeric(10,2) not null default 0 check (monto_pagado >= 0),
  saldo             numeric(10,2) not null check (saldo >= 0),
  estado            estado_credito not null default 'pendiente',
  fecha_vencimiento date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_creditos_cliente_id on creditos_cliente(cliente_id);
create index idx_creditos_estado on creditos_cliente(sucursal_id, estado);

create trigger trg_creditos_updated_at
  before update on creditos_cliente
  for each row execute function set_updated_at();

-- ============================================================
-- TABLA: auditoria_eventos
-- ============================================================
create table auditoria_eventos (
  id              uuid primary key default gen_random_uuid(),
  sucursal_id     uuid references sucursales(id) on delete set null,
  usuario_id      uuid references usuarios(id) on delete set null,
  entidad         text not null,
  entidad_id      uuid,
  accion          text not null,
  datos_anteriores jsonb,
  datos_nuevos     jsonb,
  ip_address       inet,
  created_at       timestamptz not null default now()
);

create index idx_auditoria_entidad on auditoria_eventos(entidad, entidad_id);
create index idx_auditoria_sucursal_id on auditoria_eventos(sucursal_id, created_at desc);
