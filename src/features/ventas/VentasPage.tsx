import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  AlertTriangle,
  Banknote,
  ChevronRight,
  ClipboardList,
  CreditCard,
  Landmark,
  Percent,
  Receipt,
  RefreshCw,
  Shuffle,
  ShoppingBag,
  Smartphone,
  Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import { formatCurrency, formatDateTime } from '@/shared/utils/formatters'
import { cn } from '@/shared/utils/cn'
import { Button, DataTable, EmptyState, Field, Modal, SegmentedControl, StatCard } from '@/shared/ui'
import type { Column } from '@/shared/ui'
import type { MedioPago, EstadoVenta } from '@/shared/types/database'

// ─── Types ───────────────────────────────────────────────────────────────────

interface VentaDetalle {
  id: string
  sucursal_id: string
  subtotal: number
  descuento: number
  total: number
  medio_pago: MedioPago
  estado: EstadoVenta
  observaciones: string | null
  created_at: string
  updated_at: string
  cliente_id: string | null
  cliente_nombre: string | null
  cliente_telefono: string | null
  usuario_id: string
  usuario_nombre: string
  total_items: number
}

interface VentaItemConNombre {
  id: string
  venta_id: string
  producto_id: string | null
  cantidad: number
  precio_unitario: number
  subtotal: number
  producto_nombre: string | null
  producto_codigo: string | null
}

interface VentaItemRaw {
  id: string
  venta_id: string
  producto_id: string | null
  cantidad: number
  precio_unitario: number
  subtotal: number
  productos: { nombre: string; codigo_interno: string } | null
}

type Periodo = 'hoy' | 'ayer' | 'semana' | 'mes'
type FiltroEstado = 'todas' | 'emitida' | 'anulada'

// ─── Period helpers ───────────────────────────────────────────────────────────

function calcularFechas(periodo: Periodo): { desde: string; hasta: string } {
  const now = new Date()
  const toISO = (d: Date) => d.toISOString()

  if (periodo === 'hoy') {
    const desde = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
    return { desde: toISO(desde), hasta: toISO(now) }
  }

  if (periodo === 'ayer') {
    const ayer = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
    const desde = new Date(ayer.getFullYear(), ayer.getMonth(), ayer.getDate(), 0, 0, 0)
    const hasta = new Date(ayer.getFullYear(), ayer.getMonth(), ayer.getDate(), 23, 59, 59)
    return { desde: toISO(desde), hasta: toISO(hasta) }
  }

  if (periodo === 'semana') {
    const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1 // Monday=0
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek, 0, 0, 0)
    return { desde: toISO(monday), hasta: toISO(now) }
  }

  const desde = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0)
  return { desde: toISO(desde), hasta: toISO(now) }
}

// ─── Medio pago config ────────────────────────────────────────────────────────

const MEDIO_PAGO_CONFIG: Record<MedioPago, { label: string; icon: LucideIcon; color: string }> = {
  efectivo: { label: 'Efectivo', icon: Banknote, color: 'bg-green-100 text-green-700' },
  yape: { label: 'Yape', icon: Smartphone, color: 'bg-purple-100 text-purple-700' },
  plin: { label: 'Plin', icon: Smartphone, color: 'bg-blue-100 text-blue-700' },
  tarjeta: { label: 'Tarjeta', icon: CreditCard, color: 'bg-indigo-100 text-indigo-700' },
  transferencia: { label: 'Transferencia', icon: Landmark, color: 'bg-sky-100 text-sky-700' },
  credito: { label: 'Crédito', icon: ClipboardList, color: 'bg-orange-100 text-orange-700' },
  mixto: { label: 'Mixto', icon: Shuffle, color: 'bg-gray-100 text-gray-700' },
}

// ─── Detalle expandido de una venta ───────────────────────────────────────────

function VentaItemsPanel({ ventaId }: { ventaId: string }) {
  const { data: items, isLoading } = useQuery<VentaItemConNombre[]>({
    queryKey: ['venta-items', ventaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('venta_items')
        .select('id, venta_id, producto_id, cantidad, precio_unitario, subtotal, productos(nombre, codigo_interno)')
        .eq('venta_id', ventaId)

      if (error) throw error

      return ((data ?? []) as unknown as VentaItemRaw[]).map((item) => ({
        id: item.id,
        venta_id: item.venta_id,
        producto_id: item.producto_id,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        subtotal: item.subtotal,
        producto_nombre: item.productos?.nombre ?? null,
        producto_codigo: item.productos?.codigo_interno ?? null,
      }))
    },
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) {
    return (
      <p role="status" className="text-sm text-fg-muted">
        Cargando productos…
      </p>
    )
  }

  if (!items || items.length === 0) {
    return <p className="text-sm text-fg-subtle">Sin productos registrados.</p>
  }

  return (
    <ul aria-label="Productos de la venta" className="divide-y divide-line text-sm">
      {items.map((item) => (
        <li key={item.id} className="flex items-start justify-between gap-4 py-2">
          <div className="min-w-0">
            <p className="font-medium text-fg">{item.producto_nombre ?? '(Producto eliminado)'}</p>
            <p className="font-mono text-xs text-fg-subtle">{item.producto_codigo ?? '—'}</p>
          </div>
          <div className="flex-shrink-0 text-right">
            <p className="font-semibold text-primary-700">{formatCurrency(item.subtotal)}</p>
            <p className="text-xs text-fg-muted">
              {item.cantidad} × {formatCurrency(item.precio_unitario)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}

// ─── Anular Modal ─────────────────────────────────────────────────────────────

interface AnularModalProps {
  venta: VentaDetalle
  onClose: () => void
  onSuccess: () => void
}

function AnularModal({ venta, onClose, onSuccess }: AnularModalProps) {
  const [motivo, setMotivo] = useState('')
  const [loading, setLoading] = useState(false)
  const largo = motivo.trim().length
  const motivoError = largo > 0 && largo < 10 ? `Mínimo 10 caracteres (${largo}/10)` : undefined

  async function handleAnular(e: React.FormEvent) {
    e.preventDefault()
    if (largo < 10) {
      toast.error('El motivo debe tener al menos 10 caracteres')
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.rpc('anular_venta', {
        p_venta_id: venta.id,
        p_motivo: motivo.trim(),
      })
      if (error) throw error
      toast.success('Venta anulada correctamente')
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al anular la venta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open
      onOpenChange={(open) => !open && !loading && onClose()}
      title="Anular venta"
      description={`Venta #${venta.id.slice(0, 8).toUpperCase()} — ${formatCurrency(venta.total)}`}
      persistent={loading}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" form="anular-venta-form" variant="danger" loading={loading} disabled={largo < 10}>
            {loading ? 'Anulando…' : 'Confirmar anulación'}
          </Button>
        </>
      }
    >
      <form id="anular-venta-form" onSubmit={handleAnular} className="space-y-4">
        <div role="note" className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          Esta acción no se puede deshacer. El stock de los productos será restaurado.
        </div>

        <Field label="Motivo de anulación" required error={motivoError} hint={largo >= 10 ? `${largo} caracteres` : undefined}>
          {(p) => (
            <textarea
              {...p}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="input-field resize-none"
              rows={3}
              placeholder="Describe el motivo de la anulación (mín. 10 caracteres)..."
              autoFocus
            />
          )}
        </Field>
      </form>
    </Modal>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VentasPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [periodo, setPeriodo] = useState<Periodo>('hoy')
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todas')
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [ventaAAnular, setVentaAAnular] = useState<VentaDetalle | null>(null)

  const { desde, hasta } = calcularFechas(periodo)

  const { data: ventas = [], isLoading, error, refetch, isFetching } = useQuery<VentaDetalle[]>({
    queryKey: ['ventas', user?.sucursal_id, periodo],
    queryFn: async () => {
      if (!user?.sucursal_id) return []
      const { data, error } = await supabase
        .from('vw_ventas_detalle')
        .select('*')
        .eq('sucursal_id', user.sucursal_id)
        .gte('created_at', desde)
        .lte('created_at', hasta)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!user?.sucursal_id,
    refetchInterval: 30_000,
  })

  const ventasFiltradas = ventas.filter((v) => filtroEstado === 'todas' || v.estado === filtroEstado)

  const emitidas = ventas.filter((v) => v.estado === 'emitida')
  const resumen = {
    totalVendido: emitidas.reduce((s, v) => s + v.total, 0),
    cantidadVentas: emitidas.length,
    descuentosDados: emitidas.reduce((s, v) => s + v.descuento, 0),
  }

  function toggleRow(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const canAnular = user?.rol === 'admin' || user?.rol === 'superadmin'

  const periodOptions: { value: Periodo; label: string }[] = [
    { value: 'hoy', label: 'Hoy' },
    { value: 'ayer', label: 'Ayer' },
    { value: 'semana', label: 'Semana' },
    { value: 'mes', label: 'Mes' },
  ]

  const estadoOptions: { value: FiltroEstado; label: string }[] = [
    { value: 'todas', label: 'Todas' },
    { value: 'emitida', label: 'Emitidas' },
    { value: 'anulada', label: 'Anuladas' },
  ]

  const columns: Column<VentaDetalle>[] = [
    {
      key: 'expand',
      header: 'Detalle',
      srOnlyHeader: true,
      mobile: 'hidden',
      className: 'w-10',
      cell: (v) => (
        <button
          type="button"
          onClick={() => toggleRow(v.id)}
          aria-expanded={expandedRows.has(v.id)}
          aria-label={`${expandedRows.has(v.id) ? 'Ocultar' : 'Ver'} productos de la venta ${v.id.slice(0, 8).toUpperCase()}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-fg-subtle transition-colors hover:bg-muted hover:text-primary-700"
        >
          <ChevronRight className={cn('h-4 w-4 transition-transform', expandedRows.has(v.id) && 'rotate-90')} aria-hidden="true" />
        </button>
      ),
    },
    {
      key: 'hora',
      header: 'Fecha y hora',
      mobile: 'subtitle',
      cell: (v) => <span className="whitespace-nowrap">{formatDateTime(v.created_at)}</span>,
    },
    {
      key: 'cliente',
      header: 'Cliente',
      mobile: 'title',
      cell: (v) =>
        v.cliente_nombre ? (
          <div>
            <p className="max-w-[160px] truncate font-medium text-fg md:max-w-[200px] xl:max-w-[260px]">{v.cliente_nombre}</p>
            {v.cliente_telefono && <p className="text-xs font-normal text-fg-subtle">{v.cliente_telefono}</p>}
          </div>
        ) : (
          <span className="text-xs text-fg-subtle md:text-xs">Sin cliente</span>
        ),
    },
    { key: 'vendedor', header: 'Vendedor', hideBelowLg: true, cell: (v) => <span className="block max-w-[120px] truncate">{v.usuario_nombre}</span> },
    {
      key: 'items',
      header: 'Items',
      align: 'center',
      cell: (v) => (
        <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-primary-700/10 px-1.5 text-xs font-bold text-primary-700">
          {v.total_items}
        </span>
      ),
    },
    {
      key: 'medio',
      header: 'Medio de pago',
      cell: (v) => {
        const cfg = MEDIO_PAGO_CONFIG[v.medio_pago]
        const Icon = cfg.icon
        return (
          <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium', cfg.color)}>
            <Icon className="h-3 w-3" aria-hidden="true" />
            {cfg.label}
          </span>
        )
      },
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      cell: (v) => {
        const anulada = v.estado === 'anulada'
        return (
          <div className="font-semibold">
            <span className={cn(anulada ? 'text-fg-subtle line-through' : 'text-fg')}>{formatCurrency(v.total)}</span>
            {v.descuento > 0 && !anulada && (
              <p className="text-xs font-normal text-orange-700 dark:text-orange-300">-{formatCurrency(v.descuento)} dto.</p>
            )}
          </div>
        )
      },
    },
    {
      key: 'estado',
      header: 'Estado',
      align: 'center',
      cell: (v) =>
        v.estado === 'anulada' ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-700">
            <span className="h-1.5 w-1.5 rounded-full bg-gray-500" aria-hidden="true" />
            Anulada
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
            <span className="h-1.5 w-1.5 rounded-full bg-green-600" aria-hidden="true" />
            Emitida
          </span>
        ),
    },
    {
      key: 'acciones',
      header: 'Acciones',
      align: 'center',
      mobile: 'actions',
      srOnlyHeader: !canAnular,
      cell: (v) => (
        <>
          <Button variant="secondary" size="sm" className="md:hidden" onClick={() => toggleRow(v.id)} aria-expanded={expandedRows.has(v.id)}>
            <ShoppingBag className="h-3.5 w-3.5" aria-hidden="true" />
            {expandedRows.has(v.id) ? 'Ocultar productos' : 'Ver productos'}
          </Button>
          {v.estado !== 'anulada' && canAnular ? (
            <button
              type="button"
              onClick={() => setVentaAAnular(v)}
              className="min-h-touch rounded-lg border border-red-200 px-3 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 md:min-h-0"
            >
              Anular
            </button>
          ) : (
            <span className="hidden text-xs text-fg-subtle md:inline">—</span>
          )}
        </>
      ),
    },
  ]

  return (
    <div className="animate-fade-in space-y-5 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary-700">Historial de ventas</h1>
          <p className="mt-0.5 text-sm text-fg-muted">Historial y gestión de ventas</p>
        </div>
        <Button variant="secondary" onClick={() => refetch()} loading={isFetching && !isLoading} aria-label="Actualizar ventas">
          {!(isFetching && !isLoading) && <RefreshCw className="h-4 w-4" aria-hidden="true" />}
          <span className="hidden sm:inline">Actualizar</span>
        </Button>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SegmentedControl label="Período" options={periodOptions} value={periodo} onChange={setPeriodo} />
        <SegmentedControl label="Estado de la venta" options={estadoOptions} value={filtroEstado} onChange={setFiltroEstado} />
        <span className="text-xs text-fg-subtle lg:ml-auto">
          {ventasFiltradas.length} resultado{ventasFiltradas.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard label="Total vendido" value={formatCurrency(resumen.totalVendido)} hint="Solo ventas emitidas" icon={Wallet} tone="success" loading={isLoading} />
        <StatCard label="Cantidad de ventas" value={resumen.cantidadVentas} hint="Ventas emitidas en el período" icon={Receipt} tone="accent" loading={isLoading} />
        <StatCard label="Descuentos dados" value={formatCurrency(resumen.descuentosDados)} hint="Total en descuentos del período" icon={Percent} tone="warning" loading={isLoading} />
      </div>

      {error ? (
        <div className="rounded-xl border border-line bg-card">
          <EmptyState
            icon={AlertTriangle}
            title="Error al cargar las ventas"
            description="Revisa tu conexión e inténtalo de nuevo."
            action={
              <Button onClick={() => refetch()} variant="secondary">
                Reintentar
              </Button>
            }
          />
        </div>
      ) : (
        <DataTable
          caption="Ventas del período"
          columns={columns}
          rows={ventasFiltradas}
          rowKey={(v) => v.id}
          loading={isLoading}
          skeletonRows={5}
          rowClassName={(v) => (v.estado === 'anulada' ? 'bg-muted/60' : undefined)}
          expand={{ isExpanded: (v) => expandedRows.has(v.id), render: (v) => <VentaItemsPanel ventaId={v.id} /> }}
          empty={<EmptyState icon={Receipt} title="No hay ventas en este período" description="Prueba cambiando los filtros." />}
        />
      )}

      {ventaAAnular && (
        <AnularModal
          venta={ventaAAnular}
          onClose={() => setVentaAAnular(null)}
          onSuccess={() => {
            setVentaAAnular(null)
            queryClient.invalidateQueries({ queryKey: ['ventas', user?.sucursal_id, periodo] })
          }}
        />
      )}
    </div>
  )
}
