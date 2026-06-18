import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import { formatCurrency } from '@/shared/utils/formatters'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import { cn } from '@/shared/utils/cn'
import type { Database } from '@/shared/types/database'

type GananciasVentasRow    = Database['public']['Views']['vw_ganancias_ventas']['Row']
type GananciasServiciosRow = Database['public']['Views']['vw_ganancias_servicios']['Row']
type Periodo = 'hoy' | 'semana' | 'mes'

function fechaDesde(periodo: Periodo): string {
  const d = new Date()
  if (periodo === 'hoy') {
    d.setHours(0, 0, 0, 0)
  } else if (periodo === 'semana') {
    d.setDate(d.getDate() - 7)
    d.setHours(0, 0, 0, 0)
  } else {
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
  }
  return d.toISOString().split('T')[0]
}

const PERIODOS: { key: Periodo; label: string }[] = [
  { key: 'hoy',    label: 'Hoy' },
  { key: 'semana', label: 'Semana' },
  { key: 'mes',    label: 'Mes' },
]

interface MetricCardProps {
  label: string
  value: string
  sub: string
  highlight?: boolean
  color?: 'green' | 'yellow' | 'red' | 'default'
}
function MetricCard({ label, value, sub, highlight, color = 'default' }: MetricCardProps) {
  const valueColor =
    color === 'green'  ? 'text-green-700' :
    color === 'yellow' ? 'text-yellow-600' :
    color === 'red'    ? 'text-red-600' :
    'text-[#1F3864]'
  return (
    <div className={cn(
      'bg-white rounded-xl border shadow-sm p-3 sm:p-5 transition-shadow hover:shadow-md',
      highlight ? 'border-l-4 border-green-500 border-gray-100' : 'border-gray-100',
    )}>
      <p className="text-xs sm:text-sm text-gray-500 mb-1">{label}</p>
      <p className={cn('text-lg sm:text-2xl font-bold', valueColor)}>{value}</p>
      <p className="text-[10px] sm:text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  )
}

export function DashboardPage() {
  const { user } = useAuth()
  const [periodo, setPeriodo] = useState<Periodo>('mes')

  /* ── Inventario ────────────────────────────────────────────── */
  const { data: stockBajo } = useQuery({
    queryKey: ['stock-bajo-count', user?.sucursal_id],
    queryFn: async () => {
      const { count } = await supabase
        .from('vw_stock_bajo')
        .select('*', { count: 'exact', head: true })
        .eq('sucursal_id', user!.sucursal_id)
      return count ?? 0
    },
    enabled: !!user,
  })

  const { data: valorInventario } = useQuery({
    queryKey: ['valor-inventario', user?.sucursal_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('vw_valor_inventario')
        .select('valor_venta, valor_costo, total_productos, total_unidades')
        .eq('sucursal_id', user!.sucursal_id)
      return {
        valor:     (data ?? []).reduce((s, r) => s + Number(r.valor_venta), 0),
        productos: (data ?? []).reduce((s, r) => s + Number(r.total_productos), 0),
        unidades:  (data ?? []).reduce((s, r) => s + Number(r.total_unidades), 0),
      }
    },
    enabled: !!user,
  })

  /* ── Rentabilidad ventas POS ───────────────────────────────── */
  const { data: gananciasVentas, isLoading: loadingVentas } = useQuery<GananciasVentasRow[]>({
    queryKey: ['ganancias-ventas', user?.sucursal_id, periodo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vw_ganancias_ventas')
        .select('sucursal_id, fecha, ingresos, costo_real, ganancia, total_ventas')
        .eq('sucursal_id', user!.sucursal_id)
        .gte('fecha', fechaDesde(periodo))
      if (error) throw error
      return (data ?? []) as GananciasVentasRow[]
    },
    enabled: !!user,
    retry: 1,
  })

  /* ── Rentabilidad servicios ────────────────────────────────── */
  const { data: gananciasServicios, isLoading: loadingServicios } = useQuery<GananciasServiciosRow[]>({
    queryKey: ['ganancias-servicios', user?.sucursal_id, periodo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vw_ganancias_servicios')
        .select('sucursal_id, fecha, ingresos, costo_real, ganancia, total_servicios, total_mano_obra')
        .eq('sucursal_id', user!.sucursal_id)
        .gte('fecha', fechaDesde(periodo))
      if (error) throw error
      return (data ?? []) as GananciasServiciosRow[]
    },
    enabled: !!user,
    retry: 1,
  })

  /* ── Totales ventas ────────────────────────────────────────── */
  const vIngresos  = gananciasVentas?.reduce((s, r) => s + Number(r.ingresos), 0)  ?? 0
  const vGanancia  = gananciasVentas?.reduce((s, r) => s + Number(r.ganancia), 0)  ?? 0
  const vCount     = gananciasVentas?.reduce((s, r) => s + Number(r.total_ventas), 0) ?? 0
  const vMargen    = vIngresos > 0 ? (vGanancia / vIngresos) * 100 : 0

  /* ── Totales servicios ─────────────────────────────────────── */
  const sIngresos  = gananciasServicios?.reduce((s, r) => s + Number(r.ingresos), 0)       ?? 0
  const sGanancia  = gananciasServicios?.reduce((s, r) => s + Number(r.ganancia), 0)       ?? 0
  const sCount     = gananciasServicios?.reduce((s, r) => s + Number(r.total_servicios), 0) ?? 0
  const sManoObra  = gananciasServicios?.reduce((s, r) => s + Number(r.total_mano_obra), 0) ?? 0
  const sMargen    = sIngresos > 0 ? (sGanancia / sIngresos) * 100 : 0

  /* ── Grand total ───────────────────────────────────────────── */
  const totalIngresos = vIngresos + sIngresos
  const totalGanancia = vGanancia + sGanancia
  const totalMargen   = totalIngresos > 0 ? (totalGanancia / totalIngresos) * 100 : 0

  const hora = new Date().getHours()
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'

  function margenColor(pct: number, loading: boolean): 'green' | 'yellow' | 'red' | 'default' {
    if (loading) return 'default'
    if (pct >= 30) return 'green'
    if (pct >= 10) return 'yellow'
    return 'red'
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1F3864]">
          {saludo}, {user?.nombre?.split(' ')[0]}
        </h1>
        <p className="text-gray-500 text-sm mt-1">Lubricentro E' Manuel — Sistema POS</p>
      </div>

      {/* Selector de período (compartido) */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Rentabilidad</h2>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {PERIODOS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPeriodo(key)}
              className={cn(
                'px-3 py-1 text-xs rounded-md font-medium transition-colors',
                periodo === key ? 'bg-white shadow text-[#1F3864]' : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Resumen total (ventas + servicios) ──────────────── */}
      {(vIngresos > 0 || sIngresos > 0) && (
        <div className="mb-4 grid grid-cols-3 gap-2">
          <div className="col-span-3 bg-[#1F3864] rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-white/60 uppercase tracking-wide">Total recaudado</p>
              <p className="text-xl font-bold text-white">{formatCurrency(totalIngresos)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/60 uppercase tracking-wide">Ganancia total</p>
              <p className={cn('text-xl font-bold', totalGanancia >= 0 ? 'text-green-300' : 'text-red-300')}>
                {formatCurrency(totalGanancia)}
                <span className="text-sm font-normal ml-1 text-white/60">({totalMargen.toFixed(1)}%)</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Ventas POS ──────────────────────────────────────── */}
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Ventas POS
        {vCount > 0 && <span className="ml-2 font-normal text-gray-400">{vCount} transacciones</span>}
      </p>
      <div className="grid grid-cols-3 gap-3 mb-5">
        <MetricCard
          label="Ingresos"
          value={loadingVentas ? '—' : formatCurrency(vIngresos)}
          sub={loadingVentas ? '' : `${vCount} ventas`}
        />
        <MetricCard
          label="Ganancia"
          value={loadingVentas ? '—' : formatCurrency(vGanancia)}
          sub="ingreso – costo"
          highlight
          color={loadingVentas ? 'default' : vGanancia >= 0 ? 'green' : 'red'}
        />
        <MetricCard
          label="Margen"
          value={loadingVentas ? '—' : `${vMargen.toFixed(1)}%`}
          sub="sobre precio venta"
          color={margenColor(vMargen, loadingVentas)}
        />
      </div>

      {/* ── Servicios ───────────────────────────────────────── */}
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Servicios / Atenciones
        {sCount > 0 && <span className="ml-2 font-normal text-gray-400">{sCount} atenciones</span>}
      </p>
      <div className="grid grid-cols-3 gap-3 mb-6">
        <MetricCard
          label="Ingresos"
          value={loadingServicios ? '—' : formatCurrency(sIngresos)}
          sub={loadingServicios ? '' : `MO: ${formatCurrency(sManoObra)}`}
        />
        <MetricCard
          label="Ganancia"
          value={loadingServicios ? '—' : formatCurrency(sGanancia)}
          sub="ingresos – costo productos"
          highlight
          color={loadingServicios ? 'default' : sGanancia >= 0 ? 'green' : 'red'}
        />
        <MetricCard
          label="Margen"
          value={loadingServicios ? '—' : `${sMargen.toFixed(1)}%`}
          sub="sobre precio servicio"
          color={margenColor(sMargen, loadingServicios)}
        />
      </div>

      {/* ── Inventario ──────────────────────────────────────── */}
      <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Inventario</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 sm:p-5 transition-shadow hover:shadow-md">
          <p className="text-xs sm:text-sm text-gray-500 mb-1">Productos activos</p>
          <p className="text-xl sm:text-2xl font-bold text-[#1F3864]">
            {valorInventario?.productos ?? '—'}
          </p>
          <p className="text-[10px] sm:text-xs text-gray-400 mt-1">{valorInventario?.unidades ?? '—'} unidades</p>
        </div>

        <div className={`bg-white rounded-xl border shadow-sm p-3 sm:p-5 transition-shadow hover:shadow-md ${(stockBajo ?? 0) > 0 ? 'border-red-200 bg-red-50' : 'border-gray-100'}`}>
          <p className="text-xs sm:text-sm text-gray-500 mb-1">Stock bajo</p>
          <p className={`text-xl sm:text-2xl font-bold ${(stockBajo ?? 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {stockBajo ?? '—'}
          </p>
          <p className="text-[10px] sm:text-xs text-gray-400 mt-1">bajo el mínimo</p>
        </div>

        <div className="col-span-2 sm:col-span-1 bg-white rounded-xl border border-gray-100 shadow-sm p-3 sm:p-5 transition-shadow hover:shadow-md">
          <p className="text-xs sm:text-sm text-gray-500 mb-1">Valor inventario</p>
          <p className="text-lg sm:text-2xl font-bold text-[#1F3864]">
            {valorInventario ? formatCurrency(valorInventario.valor) : '—'}
          </p>
          <p className="text-[10px] sm:text-xs text-gray-400 mt-1">precio venta total</p>
        </div>
      </div>

      {/* ── Accesos rápidos ─────────────────────────────────── */}
      <h2 className="text-base font-semibold text-gray-700 mb-3">Accesos rápidos</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { to: '/servicios/nuevo', label: 'Nueva Atención', color: 'bg-emerald-600', desc: 'Registrar servicio' },
          { to: '/vender',          label: 'Vender',         color: 'bg-blue-600',    desc: 'Venta directa POS' },
          { to: '/vehiculos',       label: 'Vehículos',      color: 'bg-[#1F3864]',   desc: 'Historial por placa' },
          { to: '/inventario',      label: 'Inventario',     color: 'bg-purple-600',  desc: 'Stock y alertas' },
        ].map(({ to, label, color, desc }) => (
          <Link
            key={to}
            to={to}
            className={`${color} text-white rounded-xl p-4 hover:opacity-90 transition-opacity`}
          >
            <p className="font-semibold text-sm">{label}</p>
            <p className="text-xs opacity-75 mt-0.5">{desc}</p>
          </Link>
        ))}
      </div>

      {stockBajo != null && stockBajo > 0 && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between">
          <div>
            <p className="font-semibold text-red-800 text-sm">
              ⚠️ {stockBajo} producto{stockBajo > 1 ? 's' : ''} con stock bajo
            </p>
            <p className="text-red-600 text-xs mt-0.5">Revisar y reponer para evitar quiebres de stock</p>
          </div>
          <Link to="/inventario" className="text-sm font-medium text-red-700 hover:text-red-900 underline">
            Ver alertas →
          </Link>
        </div>
      )}
    </div>
  )
}
