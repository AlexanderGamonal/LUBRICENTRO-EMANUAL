-- 013_vw_ganancias_servicios.sql
-- Vista de rentabilidad de servicios por día.
-- Requiere migraciones 011 (monto_servicio) y 009 (servicio_productos).
-- Aplicar en: Supabase Dashboard > SQL Editor

create or replace view vw_ganancias_servicios as
select
  s.sucursal_id,
  date_trunc('day', s.created_at at time zone 'America/Lima')::date  as fecha,
  -- Ingresos: total del servicio (mano de obra + productos a precio de venta)
  sum(s.total)                                                         as ingresos,
  -- Costo real: solo el costo de los productos utilizados (mano de obra no tiene costo)
  coalesce(sum(sp_costs.costo_total), 0)                             as costo_real,
  -- Ganancia: ingresos menos costo de productos (mano de obra es ganancia 100%)
  sum(s.total) - coalesce(sum(sp_costs.costo_total), 0)              as ganancia,
  -- Cantidad de servicios
  count(distinct s.id)                                                 as total_servicios,
  -- Mano de obra total (cobro por trabajo, sin productos)
  sum(coalesce(s.monto_servicio, 0))                                  as total_mano_obra
from servicios s
left join (
  select
    sp.servicio_id,
    sum(sp.cantidad * coalesce(p.costo, 0))  as costo_total
  from servicio_productos sp
  join productos p on p.id = sp.producto_id
  group by sp.servicio_id
) sp_costs on sp_costs.servicio_id = s.id
where s.estado = 'terminado'
group by
  s.sucursal_id,
  date_trunc('day', s.created_at at time zone 'America/Lima')::date
order by fecha desc;
