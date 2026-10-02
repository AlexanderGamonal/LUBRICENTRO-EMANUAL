import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Boxes,
  Coins,
  Package,
  Percent,
  Receipt,
  ShoppingCart,
  Wallet,
  Warehouse,
  Wrench,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import {
  diasAtrasLima,
  fechaLargaLima,
  formatCurrency,
  hoyLima,
  horaLima,
  inicioMesLima,
} from '@/shared/utils/formatters'
import { SegmentedControl, StatCard } from '@/shared/ui'
import type { StatTone } from '@/shared/ui'
import { cn } from '@/shared/utils/cn'
import type { Database } from '@/shared/types/database'

type GananciasVentasRow = Database['public']['Views']['vw_ganancias_ventas']['Row']
type GananciasServiciosRow = Database['public']['Views']['vw_ganancias_servicios']['Row']
type Periodo = 'hoy' | 'semana' | 'mes'

function fechaDesde(periodo: Periodo): string {
  if (periodo === 'hoy') return hoyLima()
  if (periodo === 'semana') return diasAtrasLima(7)
  return inicioMesLima()
}

const PERIODOS: { value: Periodo; label: string }[] = [
  { value: 'hoy', label: 'Hoy' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mes' },
]

const PERIODO_TEXTO: Record<Periodo, string> = {
  hoy: 'hoy',
  semana: 'los últimos 7 días',
  mes: 'este mes',
}

/** Verde ≥30 %, ámbar ≥10 %, rojo por debajo; neutro si no hubo ingresos. */
function tonoMargen(pct: number, ingresos: number): StatTone {
  if (ingresos <= 0) return 'neutral'
  if (pct >= 30) return 'success'
  if (pct >= 10) return 'warning'
  return 'danger'
}

interface QuickAction {
  to: string
  label: string
  hint: string
  icon: LucideIcon
  className: string
}

const ACCIONES: QuickAction[] = [
  { to: '/ventas/nueva', label: 'Vender', hint: 'Venta directa POS', icon: ShoppingCart, className: 'bg-accent-700 hover:bg-accent-800 text-white' },
  { to: '/servicios/nuevo', label: 'Nueva atención', hint: 'Registrar servicio', icon: Wrench, className: 'bg-emerald-700 hover:bg-emerald-800 text-white' },
  { to: '/caja', label: 'Caja', hint: 'Abrir o cerrar turno', icon: Wallet, className: 'bg-primary-700 hover:bg-primary-800 text-white' },
  { to: '/inventario', label: 'Inventario', hint: 'Stock y alertas', icon: Boxes, className: 'bg-violet-700 hover:bg-violet-800 text-white' },
]

function SectionTitle({ icon: Icon, children, aside }: { icon: LucideIcon; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <Icon className="h-4 w-4 text-fg-subtle" aria-hidden="true" />
      <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-fg-muted">{children}</h2>
      {aside}
    </div>
  )
}

export function DashboardPage() {
  const { user } = useAuth()
  const esAdmin = user?.rol === 'admin' || user?.rol === 'superadmin'
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

  const saludo = (() => {
    const h = horaLima()
    return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'
  })()

  const hayMovimientos = vIngresos > 0 || sIngresos > 0
  const cargando = loadingVentas || loadingServicios
  const nombre = user?.nombre?.split(' ')[0]

  return (
    <div className="mx-auto max-w-6xl space-y-7 p-4 sm:p-6">
      {/* Encabezado */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-fg sm:text-3xl">
            {saludo}, <span className="text-primary-600">{nombre}</span>
          </h1>
          <p className="mt-1 text-sm font-medium text-fg-muted first-letter:uppercase">{fechaLargaLima()}</p>
        </div>
        <SegmentedControl label="Período del resumen" options={PERIODOS} value={periodo} onChange={setPeriodo} />
      </div>

      {/* Acciones rápidas: lo más usado va primero */}
      <section aria-label="Acciones rápidas">
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {ACCIONES.map(({ to, label, hint, icon: Icon, className }) => (
            <li key={to}>
              <Link
                to={to}
                className={cn(
                  'flex min-h-[72px] items-center gap-3 rounded-2xl p-3.5 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md sm:p-4',
                  className,
                )}
              >
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/20" aria-hidden="true">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-display text-sm font-bold">{label}</span>
                  <span className="block truncate text-xs">{hint}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Alerta de stock */}
      {(stockBajo ?? 0) > 0 && (
        <Link
          to="/inventario"
          className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-500/30"
        >
          <AlertTriangle className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1 text-sm font-semibold">
            {stockBajo} producto{stockBajo === 1 ? '' : 's'} con stock bajo el mínimo
          </span>
          <span className="flex flex-shrink-0 items-center gap-1 text-sm font-semibold">
            Ver <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </span>
        </Link>
      )}

      {/* Resumen del período */}
      <section aria-label={`Resumen de ${PERIODO_TEXTO[periodo]}`}>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary-800 to-primary-600 p-5 text-white shadow-btn-primary sm:p-7">
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-64 bg-gradient-to-l from-white/10 to-transparent" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-display text-xs font-semibold uppercase tracking-wider text-primary-100">Total recaudado · {PERIODO_TEXTO[periodo]}</p>
              <p className="mt-1 font-display text-4xl font-bold tracking-tight tabular-nums sm:text-5xl">
                {cargando ? '—' : formatCurrency(totalIngresos)}
              </p>
              {!cargando && !hayMovimientos && <p className="mt-1 text-sm text-primary-100">Aún no hay movimientos en este período.</p>}
            </div>
            {esAdmin && (
              <div className="sm:text-right">
                <p className="font-display text-xs font-semibold uppercase tracking-wider text-primary-100">Ganancia total</p>
                <p className={cn('mt-1 font-display text-2xl font-bold tracking-tight tabular-nums sm:text-3xl', totalGanancia >= 0 ? 'text-emerald-300' : 'text-rose-300')}>
                  {cargando ? '—' : formatCurrency(totalGanancia)}
                  {hayMovimientos && <span className="ml-2 text-base font-medium text-primary-100">({totalMargen.toFixed(1)}%)</span>}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Ventas POS */}
      <section aria-label="Ventas POS">
        <SectionTitle
          icon={ShoppingCart}
          aside={vCount > 0 && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-fg-muted">{vCount} transacciones</span>}
        >
          Ventas POS
        </SectionTitle>
        <div className={cn('grid grid-cols-2 gap-3', esAdmin ? 'sm:grid-cols-4' : 'sm:grid-cols-2')}>
          <StatCard stackOnMobile label="Ingresos" value={formatCurrency(vIngresos)} hint={`${vCount} venta${vCount === 1 ? '' : 's'}`} icon={Banknote} tone="accent" loading={loadingVentas} />
          <StatCard stackOnMobile label="Ticket promedio" value={formatCurrency(vCount > 0 ? vIngresos / vCount : 0)} hint="por venta" icon={Receipt} tone="neutral" loading={loadingVentas} />
          {esAdmin && (
            <>
              <StatCard stackOnMobile label="Ganancia" value={formatCurrency(vGanancia)} hint="ingreso – costo" icon={Coins} tone={vIngresos > 0 ? (vGanancia >= 0 ? 'success' : 'danger') : 'neutral'} loading={loadingVentas} />
              <StatCard stackOnMobile label="Margen" value={`${vMargen.toFixed(1)}%`} hint="sobre precio de venta" icon={Percent} tone={tonoMargen(vMargen, vIngresos)} loading={loadingVentas} />
            </>
          )}
        </div>
      </section>

      {/* Servicios */}
      <section aria-label="Servicios y atenciones">
        <SectionTitle
          icon={Wrench}
          aside={sCount > 0 && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-fg-muted">{sCount} atenciones</span>}
        >
          Servicios / atenciones
        </SectionTitle>
        <div className={cn('grid grid-cols-2 gap-3', esAdmin ? 'sm:grid-cols-4' : 'sm:grid-cols-2')}>
          <StatCard stackOnMobile label="Ingresos" value={formatCurrency(sIngresos)} hint={`${sCount} atención${sCount === 1 ? '' : 'es'}`} icon={Banknote} tone="accent" loading={loadingServicios} />
          <StatCard stackOnMobile label="Mano de obra" value={formatCurrency(sManoObra)} hint="cobrado por trabajo" icon={Wrench} tone="neutral" loading={loadingServicios} />
          {esAdmin && (
            <>
              <StatCard stackOnMobile label="Ganancia" value={formatCurrency(sGanancia)} hint="ingresos – costo de productos" icon={Coins} tone={sIngresos > 0 ? (sGanancia >= 0 ? 'success' : 'danger') : 'neutral'} loading={loadingServicios} />
              <StatCard stackOnMobile label="Margen" value={`${sMargen.toFixed(1)}%`} hint="sobre precio del servicio" icon={Percent} tone={tonoMargen(sMargen, sIngresos)} loading={loadingServicios} />
            </>
          )}
        </div>
      </section>

      {/* Inventario */}
      <section aria-label="Inventario">
        <SectionTitle icon={Package}>Inventario</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard stackOnMobile label="Productos activos" value={valorInventario?.productos ?? '—'} hint={`${valorInventario?.unidades ?? '—'} unidades`} icon={Package} tone="accent" />
          <StatCard
            stackOnMobile
            label="Stock bajo"
            value={stockBajo ?? '—'}
            hint="bajo el mínimo"
            icon={AlertTriangle}
            tone={stockBajo === undefined ? 'neutral' : stockBajo > 0 ? 'danger' : 'success'}
          />
          <StatCard
            stackOnMobile
            label="Valor del inventario"
            value={valorInventario ? formatCurrency(valorInventario.valor) : '—'}
            hint="a precio de venta"
            icon={Warehouse}
            tone="neutral"
            className="col-span-2 sm:col-span-1"
          />
        </div>
      </section>
    </div>
  )
}
