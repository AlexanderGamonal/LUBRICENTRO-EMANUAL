-- 006_views_reports.sql
-- Vistas para reportes y consultas del frontend

-- ============================================================
-- VISTA: vw_productos_detalle
-- Detalle completo de productos con categoría y ubicación
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
  p.costo,
  p.stock_actual,
  p.stock_minimo,
  p.tiene_codigo_barras,
  p.foto_url,
  p.activo,
  p.created_at,
  p.updated_at,
  -- Categoría
  c.id   as categoria_id,
  c.nombre as categoria_nombre,
  -- Ubicación
  u.id     as ubicacion_id,
  u.zona,
  u.estante,
  u.nivel,
  u.codigo as ubicacion_codigo,
  -- Estado del stock
  case
    when p.stock_actual = 0 then 'agotado'
    when p.stock_actual <= p.stock_minimo then 'bajo'
    else 'ok'
  end as stock_estado,
  -- Valor de inventario
  p.stock_actual * p.costo        as valor_costo_total,
  p.stock_actual * p.precio_venta as valor_venta_total
from productos p
left join categorias c  on c.id = p.categoria_id
left join ubicaciones u on u.id = p.ubicacion_id;

-- ============================================================
-- VISTA: vw_stock_bajo
-- Productos con stock igual o por debajo del mínimo
-- ============================================================
create or replace view vw_stock_bajo as
select
  id, sucursal_id, codigo_interno, nombre, marca,
  categoria_nombre, ubicacion_codigo,
  stock_actual, stock_minimo,
  stock_minimo - stock_actual as deficit,
  stock_estado, precio_venta, costo
from vw_productos_detalle
where stock_actual <= stock_minimo
  and activo = true
order by deficit desc, nombre;

-- ============================================================
-- VISTA: vw_valor_inventario
-- Resumen de valor de inventario agrupado por categoría
-- ============================================================
create or replace view vw_valor_inventario as
select
  p.sucursal_id,
  coalesce(c.nombre, 'Sin categoría')  as categoria,
  count(p.id)                           as total_productos,
  sum(p.stock_actual)                   as total_unidades,
  sum(p.stock_actual * p.costo)         as valor_costo,
  sum(p.stock_actual * p.precio_venta)  as valor_venta
from productos p
left join categorias c on c.id = p.categoria_id
where p.activo = true
group by p.sucursal_id, c.nombre
order by valor_venta desc;

-- ============================================================
-- VISTA: vw_movimientos_stock_detalle
-- Historial de movimientos con producto y usuario
-- ============================================================
create or replace view vw_movimientos_stock_detalle as
select
  m.id,
  m.sucursal_id,
  m.tipo,
  m.cantidad,
  m.cantidad_anterior,
  m.cantidad_nueva,
  m.motivo,
  m.referencia_tipo,
  m.referencia_id,
  m.created_at,
  -- Producto
  p.id            as producto_id,
  p.codigo_interno,
  p.nombre        as producto_nombre,
  p.marca         as producto_marca,
  -- Usuario
  u.id            as usuario_id,
  u.nombre        as usuario_nombre
from movimientos_stock m
join productos p on p.id = m.producto_id
left join usuarios u on u.id = m.usuario_id
order by m.created_at desc;

-- ============================================================
-- VISTA: vw_ventas_detalle
-- Ventas con cliente, usuario y conteo de items
-- ============================================================
create or replace view vw_ventas_detalle as
select
  v.id,
  v.sucursal_id,
  v.subtotal,
  v.descuento,
  v.total,
  v.medio_pago,
  v.estado,
  v.observaciones,
  v.created_at,
  v.updated_at,
  -- Cliente
  c.id     as cliente_id,
  c.nombre as cliente_nombre,
  c.telefono as cliente_telefono,
  -- Usuario vendedor
  u.id     as usuario_id,
  u.nombre as usuario_nombre,
  -- Conteo de items
  (select count(*) from venta_items vi where vi.venta_id = v.id) as total_items
from ventas v
left join clientes c on c.id = v.cliente_id
left join usuarios u on u.id = v.usuario_id
order by v.created_at desc;

-- ============================================================
-- VISTA: vw_caja_resumen
-- Resumen de caja con totales calculados
-- ============================================================
create or replace view vw_caja_resumen as
select
  ca.id,
  ca.sucursal_id,
  ca.fecha,
  ca.estado,
  ca.monto_apertura,
  ca.monto_cierre_esperado,
  ca.monto_cierre_real,
  ca.diferencia,
  ca.opened_at,
  ca.closed_at,
  ca.observaciones,
  -- Usuario apertura
  u.nombre as usuario_nombre,
  -- Ingresos y egresos
  coalesce(sum(case when cm.tipo = 'ingreso' then cm.monto else 0 end), 0) as total_ingresos,
  coalesce(sum(case when cm.tipo = 'egreso'  then cm.monto else 0 end), 0) as total_egresos,
  ca.monto_apertura + coalesce(sum(
    case when cm.tipo = 'ingreso' then cm.monto else -cm.monto end
  ), 0) as saldo_calculado,
  count(case when cm.tipo = 'ingreso' then 1 end) as num_ingresos,
  count(case when cm.tipo = 'egreso'  then 1 end) as num_egresos
from cajas ca
left join usuarios u on u.id = ca.usuario_id
left join caja_movimientos cm on cm.caja_id = ca.id
group by ca.id, u.nombre
order by ca.opened_at desc;
