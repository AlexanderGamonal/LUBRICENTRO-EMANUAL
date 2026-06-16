-- 007_seed_data.sql
-- Datos semilla: sucursal, categorías, ubicaciones

-- ============================================================
-- SUCURSAL
-- ============================================================
insert into sucursales (id, nombre, direccion, telefono, activa) values
  ('00000000-0000-0000-0000-000000000001',
   'Lubricentro E'' Manuel',
   'Av. Próceres de la Independencia Mz B-1 Lote 1, Los Pinos, SJL, Lima',
   '+51 1 000-0000',
   true)
on conflict (id) do nothing;

-- ============================================================
-- CATEGORÍAS
-- ============================================================
insert into categorias (sucursal_id, nombre, descripcion) values
  ('00000000-0000-0000-0000-000000000001', 'Aceites Motor',         'Aceites para motores a gasolina y diésel'),
  ('00000000-0000-0000-0000-000000000001', 'Filtros',               'Filtros de aceite, aire, combustible y habitáculo'),
  ('00000000-0000-0000-0000-000000000001', 'Lubricantes Especiales','Aceites de caja, dirección y transmisión'),
  ('00000000-0000-0000-0000-000000000001', 'Aditivos',              'Aditivos de motor, combustible y sistema hidráulico'),
  ('00000000-0000-0000-0000-000000000001', 'Refrigerantes',         'Líquido refrigerante y anticongelante'),
  ('00000000-0000-0000-0000-000000000001', 'Grasas',                'Grasas multipropósito y especiales'),
  ('00000000-0000-0000-0000-000000000001', 'Bujías',                'Bujías estándar, platino e iridio'),
  ('00000000-0000-0000-0000-000000000001', 'Siliconas',             'Siliconas y selladores'),
  ('00000000-0000-0000-0000-000000000001', 'Otros',                 'Productos varios de mantenimiento')
on conflict (sucursal_id, nombre) do nothing;

-- ============================================================
-- UBICACIONES (zonas A-E, 3 estantes, 3 niveles cada uno)
-- ============================================================
do $$
declare
  v_sucursal_id uuid := '00000000-0000-0000-0000-000000000001';
  v_zona char(1);
  v_estante int;
  v_nivel int;
  v_zonas char(1)[] := array['A','B','C','D','E'];
begin
  foreach v_zona in array v_zonas loop
    for v_estante in 1..3 loop
      for v_nivel in 1..3 loop
        insert into ubicaciones (sucursal_id, zona, estante, nivel)
        values (v_sucursal_id, v_zona, v_estante, v_nivel)
        on conflict (sucursal_id, zona, estante, nivel) do nothing;
      end loop;
    end loop;
  end loop;
end $$;

-- ============================================================
-- INSTRUCCIONES PARA CREAR USUARIO ADMINISTRADOR
-- ============================================================
-- Para crear el primer usuario administrador:
--
-- 1. Ve al Dashboard de Supabase > Authentication > Users
-- 2. Crea un usuario con el email de la administradora
-- 3. Copia el UUID del usuario creado (visible en la lista de usuarios)
-- 4. Ejecuta el siguiente SQL reemplazando los valores:
--
--   insert into usuarios (auth_user_id, sucursal_id, nombre, email, rol) values (
--     'UUID-DEL-USUARIO-AUTH',           -- UUID del paso 3
--     '00000000-0000-0000-0000-000000000001',
--     'Patricia Maldonado',
--     'admin@lubricentromanuel.com',
--     'admin'
--   );
--
-- 5. Para vendedores adicionales, repite el proceso con rol = 'vendedor'
--    o rol = 'almacen' según corresponda.
--
-- Roles disponibles: superadmin, admin, vendedor, almacen
-- ============================================================
