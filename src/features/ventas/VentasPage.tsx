import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import { formatCurrency, formatDateTime } from '@/shared/utils/formatters'
import { cn } from '@/shared/utils/cn'
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

interface VentaItem {
  id: string
  venta_id: string
  producto_id: string | null
  cantidad: number
  precio_unitario: number
  subtotal: number
}

interface VentaItemConNombre extends VentaItem {
  producto_nombre: string | null
  producto_codigo: string | null
}

type Periodo = 'hoy' | 'ayer' | 'semana' | 'mes'
type FiltroEstado = 'todas' | 'emitida' | 'anulada'

// ─── Period helpers ───────────────────────────────────────────────────────────

function calcularFechas(periodo: Periodo): { desde: string; hasta: string } {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')

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

  // mes
  const desde = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0)
  return { desde: toISO(desde), hasta: toISO(now) }

  void pad // avoid unused warning
}

// ─── Medio pago config ────────────────────────────────────────────────────────

const MEDIO_PAGO_CONFIG: Record<MedioPago, { label: string; emoji: string; color: string }> = {
  efectivo:      { label: 'Efectivo',      emoji: '💵', color: 'bg-green-100 text-green-700' },
  yape:          { label: 'Yape',          emoji: '🟣', color: 'bg-purple-100 text-purple-700' },
  plin:          { label: 'Plin',          emoji: '🔵', color: 'bg-blue-100 text-blue-700' },
  tarjeta:       { label: 'Tarjeta',       emoji: '💳', color: 'bg-indigo-100 text-indigo-700' },
  transferencia: { label: 'Transferencia', emoji: '🏦', color: 'bg-sky-100 text-sky-700' },
  credito:       { label: 'Crédito',       emoji: '📋', color: 'bg-orange-100 text-orange-700' },
  mixto:         { label: 'Mixto',         emoji: '🔀', color: 'bg-gray-100 text-gray-700' },
}

// ─── Expanded row items ───────────────────────────────────────────────────────

function VentaItemsRow({ ventaId }: { ventaId: string }) {
  const { data: items, isLoading } = useQuery<VentaItemConNombre[]>({
    queryKey: ['venta-items', ventaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('venta_items')
        .select(`
          id,
          venta_id,
          producto_id,
          cantidad,
          precio_unitario,
          subtotal,
          productos(nombre, codigo_interno)
        `)
        .eq('venta_id', ventaId)

      if (error) throw error

      return (data ?? []).map((item: any) => ({
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
      <td colSpan={8} className="px-6 py-3 bg-gray-50">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <svg className="animate-spin w-4 h-4 text-[#1F3864]" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Cargando items...
        </div>
      </td>
    )
  }

  return (
    <td colSpan={8} className="px-0 bg-slate-50 border-t border-slate-100">
      <div className="px-12 py-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-gray-200">
              <th className="text-left pb-2 font-semibold">Producto</th>
              <th className="text-left pb-2 font-semibold">Código</th>
              <th className="text-right pb-2 font-semibold">Cant.</th>
              <th className="text-right pb-2 font-semibold">Precio unit.</th>
              <th className="text-right pb-2 font-semibold">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map((item) => (
              <tr key={item.id} className="border-b border-gray-100 last:border-0">
                <td className="py-1.5 text-gray-800 font-medium">
                  {item.producto_nombre ?? '(Producto eliminado)'}
                </td>
                <td className="py-1.5 text-gray-500 font-mono text-xs">
                  {item.producto_codigo ?? '—'}
                </td>
                <td className="py-1.5 text-right text-gray-700">{item.cantidad}</td>
                <td className="py-1.5 text-right text-gray-700">
                  {formatCurrency(item.precio_unitario)}
                </td>
                <td className="py-1.5 text-right font-semibold text-[#1F3864]">
                  {formatCurrency(item.subtotal)}
                </td>
              </tr>
            ))}
            {(items ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="py-3 text-center text-gray-400 text-sm">
                  Sin items
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </td>
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
  const motivoError = motivo.trim().length > 0 && motivo.trim().length < 10

  async function handleAnular() {
    if (motivo.trim().length < 10) {
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
    } catch (err: any) {
      toast.error(err?.message ?? 'Error al anular la venta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Anular Venta</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Venta #{venta.id.slice(0, 8).toUpperCase()} — {formatCurrency(venta.total)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Cerrar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-red-700 font-medium">
            Esta acción no se puede deshacer. El stock de los productos será restaurado.
          </p>
        </div>

        <div className="mb-5">
          <label className="label-text">
            Motivo de anulación <span className="text-red-500">*</span>
          </label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className={cn('input-field resize-none', motivoError && 'border-red-400 focus:ring-red-300')}
            rows={3}
            placeholder="Describe el motivo de la anulación (mín. 10 caracteres)..."
            autoFocus
          />
          {motivoError && (
            <p className="error-text mt-1">Mínimo 10 caracteres ({motivo.trim().length}/10)</p>
          )}
          {!motivoError && motivo.trim().length >= 10 && (
            <p className="text-xs text-green-600 mt-1">{motivo.trim().length} caracteres</p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleAnular}
            disabled={loading || motivo.trim().length < 10}
            className="btn-danger flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Anulando...
              </span>
            ) : (
              'Confirmar Anulación'
            )}
          </button>
          <button onClick={onClose} disabled={loading} className="btn-secondary flex-1">
            Cancelar
          </button>
        </div>
      </div>
    </div>
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

  const { data: ventas = [], isLoading, error } = useQuery<VentaDetalle[]>({
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

  const ventasFiltradas = ventas.filter((v) => {
    if (filtroEstado === 'todas') return true
    return v.estado === filtroEstado
  })

  const resumen = {
    totalVendido: ventas.filter((v) => v.estado === 'emitida').reduce((s, v) => s + v.total, 0),
    cantidadVentas: ventas.filter((v) => v.estado === 'emitida').length,
    descuentosDados: ventas.filter((v) => v.estado === 'emitida').reduce((s, v) => s + v.descuento, 0),
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

  const periodOptions: { key: Periodo; label: string }[] = [
    { key: 'hoy', label: 'Hoy' },
    { key: 'ayer', label: 'Ayer' },
    { key: 'semana', label: 'Esta semana' },
    { key: 'mes', label: 'Este mes' },
  ]

  const estadoOptions: { key: FiltroEstado; label: string }[] = [
    { key: 'todas', label: 'Todas' },
    { key: 'emitida', label: 'Emitidas' },
    { key: 'anulada', label: 'Anuladas' },
  ]

  return (
    <div className="animate-fade-in p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ventas</h1>
          <p className="text-sm text-gray-500 mt-0.5">Historial y gestión de ventas</p>
        </div>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ['ventas', user?.sucursal_id, periodo] })}
          className="btn-secondary flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Actualizar
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap items-center gap-4">
        {/* Period selector */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {periodOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setPeriodo(opt.key)}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                periodo === opt.key
                  ? 'bg-white text-[#1F3864] shadow-sm font-semibold'
                  : 'text-gray-600 hover:text-gray-800'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Estado filter */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {estadoOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setFiltroEstado(opt.key)}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                filtroEstado === opt.key
                  ? 'bg-white text-[#1F3864] shadow-sm font-semibold'
                  : 'text-gray-600 hover:text-gray-800'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <span className="text-xs text-gray-400 ml-auto">
          {ventasFiltradas.length} resultado{ventasFiltradas.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Total vendido
          </p>
          <p className="text-2xl font-bold text-[#1F3864]">
            {formatCurrency(resumen.totalVendido)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Solo ventas emitidas</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Cantidad de ventas
          </p>
          <p className="text-2xl font-bold text-[#1F3864]">{resumen.cantidadVentas}</p>
          <p className="text-xs text-gray-400 mt-1">Ventas emitidas en el período</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Descuentos dados
          </p>
          <p className="text-2xl font-bold text-orange-600">
            {formatCurrency(resumen.descuentosDados)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Total en descuentos del período</p>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="text-red-600 font-medium">Error al cargar las ventas</p>
            <p className="text-sm text-gray-500 mt-1">Intenta actualizar la página</p>
          </div>
        ) : ventasFiltradas.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-gray-500 font-medium">No hay ventas en este período</p>
            <p className="text-sm text-gray-400 mt-1">Prueba cambiando los filtros</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="w-8 px-4 py-3" />
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Hora
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Cliente
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Vendedor
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Items
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Medio Pago
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Total
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ventasFiltradas.map((venta) => {
                  const isExpanded = expandedRows.has(venta.id)
                  const medioCfg = MEDIO_PAGO_CONFIG[venta.medio_pago]
                  const isAnulada = venta.estado === 'anulada'

                  return (
                    <>
                      <tr
                        key={venta.id}
                        className={cn(
                          'hover:bg-gray-50 transition-colors',
                          isAnulada && 'opacity-60 bg-gray-50'
                        )}
                      >
                        {/* Expand chevron */}
                        <td className="px-4 py-3">
                          <button
                            onClick={() => toggleRow(venta.id)}
                            className="text-gray-400 hover:text-[#1F3864] transition-colors"
                            aria-label={isExpanded ? 'Colapsar' : 'Expandir'}
                          >
                            <svg
                              className={cn('w-4 h-4 transition-transform', isExpanded && 'rotate-90')}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </td>

                        {/* Hora */}
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                          {formatDateTime(venta.created_at)}
                        </td>

                        {/* Cliente */}
                        <td className="px-4 py-3">
                          {venta.cliente_nombre ? (
                            <div>
                              <p className="font-medium text-gray-800 truncate max-w-[140px]">
                                {venta.cliente_nombre}
                              </p>
                              {venta.cliente_telefono && (
                                <p className="text-xs text-gray-400">{venta.cliente_telefono}</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">Sin cliente</span>
                          )}
                        </td>

                        {/* Vendedor */}
                        <td className="px-4 py-3 text-gray-700 truncate max-w-[120px]">
                          {venta.usuario_nombre}
                        </td>

                        {/* Items */}
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#1F3864]/10 text-[#1F3864] text-xs font-bold">
                            {venta.total_items}
                          </span>
                        </td>

                        {/* Medio pago */}
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium',
                              medioCfg.color
                            )}
                          >
                            <span>{medioCfg.emoji}</span>
                            {medioCfg.label}
                          </span>
                        </td>

                        {/* Total */}
                        <td className="px-4 py-3 text-right font-semibold">
                          <span className={cn(isAnulada && 'line-through text-gray-400')}>
                            {formatCurrency(venta.total)}
                          </span>
                          {venta.descuento > 0 && !isAnulada && (
                            <p className="text-xs text-orange-500 font-normal">
                              -{formatCurrency(venta.descuento)} dto.
                            </p>
                          )}
                        </td>

                        {/* Estado badge */}
                        <td className="px-4 py-3 text-center">
                          {isAnulada ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-200 text-gray-600">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                              Anulada
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                              Emitida
                            </span>
                          )}
                        </td>

                        {/* Acciones */}
                        <td className="px-4 py-3 text-center">
                          {!isAnulada && canAnular ? (
                            <button
                              onClick={() => setVentaAAnular(venta)}
                              className="px-3 py-1 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                            >
                              Anular
                            </button>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                      </tr>

                      {/* Expanded items row */}
                      {isExpanded && (
                        <tr key={`${venta.id}-items`} className="bg-slate-50">
                          <VentaItemsRow ventaId={venta.id} />
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Anular modal */}
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
