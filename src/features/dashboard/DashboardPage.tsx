import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import { diasAtrasLima, formatCurrency, hoyLima, inicioMesLima } from '@/shared/utils/formatters'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import { cn } from '@/shared/utils/cn'
import type { Database } from '@/shared/types/database'
import { TrendingUp, Package, Wrench, DollarSign, Target } from 'lucide-react'

type GananciasVentasRow    = Database['public']['Views']['vw_ganancias_ventas']['Row']
type GananciasServiciosRow = Database['public']['Views']['vw_ganancias_servicios']['Row']
type Periodo = 'hoy' | 'semana' | 'mes'

function fechaDesde(periodo: Periodo): string {
  if (periodo === 'hoy') return hoyLima()
  if (periodo === 'semana') return diasAtrasLima(7)
  return inicioMesLima()
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
  icon?: React.ReactNode
}
function MetricCard({ label, value, sub, highlight, color = 'default', icon }: MetricCardProps) {
  const valueColor =
    color === 'green'  ? 'text-emerald-600' :
    color === 'yellow' ? 'text-amber-500' :
    color === 'red'    ? 'text-rose-500' :
    'text-slate-800'
    
  return (
    <div className={cn(
      'bg-white rounded-2xl border p-5 transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1 relative overflow-hidden group',
      highlight ? 'border-l-4 border-l-accent-500 border-t-slate-100 border-r-slate-100 border-b-slate-100 shadow-sm' : 'border-slate-100 shadow-card',
    )}>
      {icon && (
        <div className="absolute top-4 right-4 text-slate-200 group-hover:text-slate-300 transition-colors duration-300 group-hover:scale-110">
          {icon}
        </div>
      )}
      <p className="text-[13px] font-medium text-slate-500 mb-2 font-display uppercase tracking-wide">{label}</p>
      <p className={cn('text-2xl sm:text-3xl font-bold tracking-tight', valueColor)}>{value}</p>
      <p className="text-xs text-slate-400 mt-2 font-medium">{sub}</p>
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
    <div className="p-6 max-w-5xl mx-auto space-y-8 animate-fade-in">
      {/* Header Greeting */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight font-display">
            {saludo}, <span className="text-primary-600">{user?.nombre?.split(' ')[0]}</span>
          </h1>
          <p className="text-slate-500 text-sm mt-1.5 font-medium flex items-center gap-1.5">
            <Target className="w-4 h-4 text-accent-500" />
            Resumen de actividad en tiempo real
          </p>
        </div>

        {/* Selector de período (compartido) */}
        <div className="flex gap-1 bg-slate-200/50 p-1 rounded-xl border border-slate-200/60 shadow-inner">
          {PERIODOS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPeriodo(key)}
              className={cn(
                'px-4 py-1.5 text-sm rounded-lg font-semibold transition-all duration-200',
                periodo === key 
                  ? 'bg-white shadow-sm text-primary-700' 
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Resumen total (ventas + servicios) ──────────────── */}
      {(vIngresos > 0 || sIngresos > 0) && (
        <div className="bg-gradient-to-r from-primary-800 to-primary-600 rounded-2xl p-6 md:p-8 text-white shadow-btn-primary relative overflow-hidden flex items-center justify-between">
          <div className="absolute right-0 top-0 w-64 h-full bg-gradient-to-l from-white/10 to-transparent pointer-events-none" />
          <div>
            <p className="text-sm text-primary-200 font-semibold uppercase tracking-wider font-display mb-1">Total Recaudado</p>
            <p className="text-4xl md:text-5xl font-bold tracking-tight">{formatCurrency(totalIngresos)}</p>
          </div>
          <div className="text-right z-10">
            <p className="text-sm text-primary-200 font-semibold uppercase tracking-wider font-display mb-1">Ganancia Total</p>
            <p className={cn('text-2xl md:text-3xl font-bold tracking-tight', totalGanancia >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
              {formatCurrency(totalGanancia)}
              <span className="text-lg md:text-xl font-medium ml-2 text-primary-200/80">({totalMargen.toFixed(1)}%)</span>
            </p>
          </div>
        </div>
      )}

      {/* ── Ventas POS ──────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide font-display">Ventas POS</h2>
          {vCount > 0 && <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{vCount} transacciones</span>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <MetricCard
            label="Ingresos"
            value={loadingVentas ? '—' : formatCurrency(vIngresos)}
            sub={loadingVentas ? '' : `${vCount} ventas`}
            icon={<TrendingUp className="w-10 h-10" />}
          />
          <MetricCard
            label="Ganancia"
            value={loadingVentas ? '—' : formatCurrency(vGanancia)}
            sub="ingreso – costo"
            highlight
            color={loadingVentas ? 'default' : vGanancia >= 0 ? 'green' : 'red'}
            icon={<DollarSign className="w-10 h-10" />}
          />
          <MetricCard
            label="Margen"
            value={loadingVentas ? '—' : `${vMargen.toFixed(1)}%`}
            sub="sobre precio venta"
            color={margenColor(vMargen, loadingVentas)}
            icon={<Target className="w-10 h-10" />}
          />
        </div>
      </div>

      {/* ── Servicios ───────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Wrench className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide font-display">Servicios / Atenciones</h2>
          {sCount > 0 && <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{sCount} atenciones</span>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <MetricCard
            label="Ingresos"
            value={loadingServicios ? '—' : formatCurrency(sIngresos)}
            sub={loadingServicios ? '' : `MO: ${formatCurrency(sManoObra)}`}
            icon={<TrendingUp className="w-10 h-10" />}
          />
          <MetricCard
            label="Ganancia"
            value={loadingServicios ? '—' : formatCurrency(sGanancia)}
            sub="ingresos – costo productos"
            highlight
            color={loadingServicios ? 'default' : sGanancia >= 0 ? 'green' : 'red'}
            icon={<DollarSign className="w-10 h-10" />}
          />
          <MetricCard
            label="Margen"
            value={loadingServicios ? '—' : `${sMargen.toFixed(1)}%`}
            sub="sobre precio servicio"
            color={margenColor(sMargen, loadingServicios)}
            icon={<Target className="w-10 h-10" />}
          />
        </div>
      </div>

      {/* ── Inventario ──────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Package className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide font-display">Inventario</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <MetricCard
            label="Productos activos"
            value={String(valorInventario?.productos ?? '—')}
            sub={`${valorInventario?.unidades ?? '—'} unidades`}
            icon={<Package className="w-10 h-10" />}
          />
          <MetricCard
            label="Stock bajo"
            value={String(stockBajo ?? '—')}
            sub="bajo el mínimo"
            color={(stockBajo ?? 0) > 0 ? 'red' : 'green'}
            highlight={(stockBajo ?? 0) > 0}
            icon={<Target className="w-10 h-10" />}
          />
          <MetricCard
            label="Valor inventario"
            value={valorInventario ? formatCurrency(valorInventario.valor) : '—'}
            sub="precio venta total"
            icon={<DollarSign className="w-10 h-10" />}
          />
        </div>
      </div>

      {/* ── Accesos Rápidos ─────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide font-display mb-3">Accesos rápidos</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Link
            to="/servicios/nuevo"
            className="group flex flex-col items-center justify-center p-5 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-500 transition-all duration-300 shadow-md hover:shadow-lg hover:-translate-y-1 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/20 scale-0 group-hover:scale-100 transition-transform duration-300 rounded-2xl" />
            <span className="text-sm font-bold tracking-wide relative z-10 font-display">Nueva Atención</span>
            <span className="text-xs opacity-80 relative z-10 mt-0.5">Registrar servicio</span>
          </Link>

          <Link
            to="/ventas/nueva"
            className="group flex flex-col items-center justify-center p-5 bg-primary-600 text-white rounded-2xl hover:bg-primary-500 transition-all duration-300 shadow-md hover:shadow-lg hover:-translate-y-1 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/20 scale-0 group-hover:scale-100 transition-transform duration-300 rounded-2xl" />
            <span className="text-sm font-bold tracking-wide relative z-10 font-display">Vender</span>
            <span className="text-xs opacity-80 relative z-10 mt-0.5">Venta directa POS</span>
          </Link>

          <Link
            to="/vehiculos"
            className="group flex flex-col items-center justify-center p-5 bg-slate-800 text-white rounded-2xl hover:bg-slate-700 transition-all duration-300 shadow-md hover:shadow-lg hover:-translate-y-1 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/20 scale-0 group-hover:scale-100 transition-transform duration-300 rounded-2xl" />
            <span className="text-sm font-bold tracking-wide relative z-10 font-display">Vehículos</span>
            <span className="text-xs opacity-80 relative z-10 mt-0.5">Historial por placa</span>
          </Link>

          <Link
            to="/inventario"
            className="group flex flex-col items-center justify-center p-5 bg-violet-600 text-white rounded-2xl hover:bg-violet-500 transition-all duration-300 shadow-md hover:shadow-lg hover:-translate-y-1 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/20 scale-0 group-hover:scale-100 transition-transform duration-300 rounded-2xl" />
            <span className="text-sm font-bold tracking-wide relative z-10 font-display">Inventario</span>
            <span className="text-xs opacity-80 relative z-10 mt-0.5">Stock y alertas</span>
          </Link>
        </div>
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
