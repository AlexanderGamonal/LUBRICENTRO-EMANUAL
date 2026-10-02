-- reset_datos.sql — VACÍA los datos del negocio para cargar una base nueva.
-- ⚠ DESTRUCTIVO E IRREVERSIBLE. No es una migración: no se ejecuta solo.
-- Antes de correrlo: haz un respaldo (Supabase → Database → Backups, o `pg_dump`).
--
-- Conserva: sucursales, usuarios (y auth.users, para poder iniciar sesión),
--           categorias, ubicaciones y mantenimientos_recomendados (catálogos).
-- Borra:    productos, stock, clientes, vehículos, ventas, servicios, cajas,
--           pagos, créditos y auditoría.
--
-- Uso: pégalo en el SQL Editor de Supabase. Corre dentro de una transacción:
-- revisa los conteos finales y, si algo no te convence, cambia COMMIT por ROLLBACK.

begin;

truncate table
  public.auditoria_eventos,
  public.caja_movimientos,
  public.pagos,
  public.creditos_cliente,
  public.venta_items,
  public.ventas,
  public.servicio_productos,
  public.servicios,
  public.movimientos_stock,
  public.vehiculos,
  public.clientes,
  public.productos,
  public.cajas
restart identity;

-- Verificación: todo debe quedar en 0, y los catálogos/usuarios intactos.
select 'productos' as tabla, count(*) from public.productos
union all select 'clientes', count(*) from public.clientes
union all select 'ventas', count(*) from public.ventas
union all select 'servicios', count(*) from public.servicios
union all select 'cajas', count(*) from public.cajas
union all select 'usuarios (se conservan)', count(*) from public.usuarios
union all select 'categorias (se conservan)', count(*) from public.categorias;

commit; -- cambia a ROLLBACK si quieres cancelar
