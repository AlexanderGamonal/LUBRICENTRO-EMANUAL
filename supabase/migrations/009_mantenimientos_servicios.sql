-- ============================================================
-- 009 — Mantenimientos recomendados + vista vw_servicios_detalle
-- Aplicar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Tabla mantenimientos_recomendados
create table if not exists mantenimientos_recomendados (
  id              uuid primary key default gen_random_uuid(),
  marca_vehiculo  text not null,
  modelo          text,           -- null = aplica a todos los modelos de esa marca
  tipo_servicio   text not null,  -- 'cambio_aceite' | 'filtro_aceite' | 'filtro_aire' ...
  descripcion     text not null,
  intervalo_km    integer check (intervalo_km > 0),
  intervalo_dias  integer check (intervalo_dias > 0),
  created_at      timestamptz not null default now()
);

-- 2. RLS para mantenimientos_recomendados
alter table mantenimientos_recomendados enable row level security;

create policy "todos pueden leer mantenimientos"
  on mantenimientos_recomendados for select
  to authenticated
  using (true);

create policy "admin puede gestionar mantenimientos"
  on mantenimientos_recomendados for all
  to authenticated
  using (current_user_role() in ('admin', 'superadmin'))
  with check (current_user_role() in ('admin', 'superadmin'));

-- 3. RLS para servicios y servicio_productos (si no existen)
do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'servicios' and policyname = 'sucursal_servicios_select'
  ) then
    alter table servicios enable row level security;
    execute $pol$
      create policy "sucursal_servicios_select" on servicios for select
      to authenticated using (sucursal_id = current_sucursal_id());
    $pol$;
    execute $pol$
      create policy "sucursal_servicios_insert" on servicios for insert
      to authenticated with check (sucursal_id = current_sucursal_id());
    $pol$;
    execute $pol$
      create policy "sucursal_servicios_update" on servicios for update
      to authenticated using (sucursal_id = current_sucursal_id());
    $pol$;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'servicio_productos' and policyname = 'sucursal_servicio_productos_select'
  ) then
    alter table servicio_productos enable row level security;
    execute $pol$
      create policy "sucursal_servicio_productos_select" on servicio_productos for select
      to authenticated using (sucursal_id = current_sucursal_id());
    $pol$;
    execute $pol$
      create policy "sucursal_servicio_productos_insert" on servicio_productos for insert
      to authenticated with check (sucursal_id = current_sucursal_id());
    $pol$;
  end if;
end $$;

-- 4. Vista vw_servicios_detalle
create or replace view vw_servicios_detalle as
select
  s.id,
  s.sucursal_id,
  s.vehiculo_id,
  s.cliente_id,
  s.usuario_id,
  s.kilometraje,
  s.descripcion,
  s.observaciones,
  s.estado,
  s.fecha_servicio,
  s.total,
  s.created_at,
  s.updated_at,
  v.placa,
  v.marca_vehiculo,
  v.modelo,
  v.anio,
  c.nombre  as cliente_nombre,
  c.telefono as cliente_telefono,
  u.nombre  as usuario_nombre
from servicios s
left join vehiculos      v on v.id = s.vehiculo_id
left join clientes       c on c.id = s.cliente_id
left join usuarios       u on u.id = s.usuario_id;

-- 5. Seed — mantenimientos recomendados (marcas comunes en Perú)
insert into mantenimientos_recomendados
  (marca_vehiculo, modelo, tipo_servicio, descripcion, intervalo_km, intervalo_dias)
values
  -- Toyota (sin modelo = aplica a todos)
  ('Toyota', null, 'cambio_aceite',       'Cambio de aceite de motor',         5000,  180),
  ('Toyota', null, 'filtro_aceite',       'Cambio de filtro de aceite',        5000,  180),
  ('Toyota', null, 'filtro_aire',         'Cambio de filtro de aire',          15000, 365),
  ('Toyota', null, 'filtro_combustible',  'Cambio de filtro de combustible',   30000, 730),
  ('Toyota', null, 'refrigerante',        'Cambio de refrigerante',            40000, 730),
  -- Hyundai
  ('Hyundai', null, 'cambio_aceite',      'Cambio de aceite de motor',         5000,  180),
  ('Hyundai', null, 'filtro_aceite',      'Cambio de filtro de aceite',        5000,  180),
  ('Hyundai', null, 'filtro_aire',        'Cambio de filtro de aire',          15000, 365),
  ('Hyundai', null, 'refrigerante',       'Cambio de refrigerante',            40000, 730),
  -- KIA
  ('KIA', null, 'cambio_aceite',          'Cambio de aceite de motor',         5000,  180),
  ('KIA', null, 'filtro_aceite',          'Cambio de filtro de aceite',        5000,  180),
  ('KIA', null, 'filtro_aire',            'Cambio de filtro de aire',          15000, 365),
  -- Nissan
  ('Nissan', null, 'cambio_aceite',       'Cambio de aceite de motor',         5000,  180),
  ('Nissan', null, 'filtro_aceite',       'Cambio de filtro de aceite',        5000,  180),
  ('Nissan', null, 'filtro_aire',         'Cambio de filtro de aire',          15000, 365),
  -- Chevrolet
  ('Chevrolet', null, 'cambio_aceite',    'Cambio de aceite de motor',         5000,  180),
  ('Chevrolet', null, 'filtro_aceite',    'Cambio de filtro de aceite',        5000,  180),
  ('Chevrolet', null, 'filtro_aire',      'Cambio de filtro de aire',          15000, 365),
  -- Suzuki
  ('Suzuki', null, 'cambio_aceite',       'Cambio de aceite de motor',         5000,  180),
  ('Suzuki', null, 'filtro_aceite',       'Cambio de filtro de aceite',        5000,  180),
  -- Volkswagen
  ('Volkswagen', null, 'cambio_aceite',   'Cambio de aceite de motor',         10000, 365),
  ('Volkswagen', null, 'filtro_aceite',   'Cambio de filtro de aceite',        10000, 365),
  ('Volkswagen', null, 'filtro_aire',     'Cambio de filtro de aire',          20000, 365),
  -- General (sirve para cualquier vehículo)
  ('General', null, 'cambio_aceite',      'Cambio de aceite de motor',         5000,  180),
  ('General', null, 'filtro_aceite',      'Cambio de filtro de aceite',        5000,  180),
  ('General', null, 'filtro_aire',        'Cambio de filtro de aire',          15000, 365),
  ('General', null, 'filtro_combustible', 'Cambio de filtro de combustible',   30000, 730),
  ('General', null, 'refrigerante',       'Cambio de refrigerante',            40000, 730),
  ('General', null, 'aceite_caja',        'Cambio de aceite de caja',          40000, 1460),
  ('General', null, 'aceite_diferencial', 'Cambio de aceite diferencial',      40000, 1460),
  ('General', null, 'liquido_frenos',     'Cambio de líquido de frenos',       30000, 730)
on conflict do nothing;
