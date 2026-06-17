import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
  type ChangeEvent,
} from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { formatCurrency, formatDateTime } from '@/shared/utils/formatters'
import { cn } from '@/shared/utils/cn'
import type { MedioPago } from '@/shared/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductoDetalle {
  id: string
  sucursal_id: string
  codigo_interno: string
  codigo_barras: string | null
  nombre: string
  marca: string | null
  viscosidad_especificacion: string | null
  precio_venta: number
  costo: number
  stock_actual: number
  stock_minimo: number
  tiene_codigo_barras: boolean
  foto_url: string | null
  activo: boolean
  categoria_nombre: string | null
  stock_estado: 'ok' | 'bajo' | 'agotado'
}

interface ClienteRow {
  id: string
  sucursal_id: string
  nombre: string
  telefono: string | null
  tipo: 'natural' | 'empresa'
  ruc_dni: string | null
  activo: boolean
}

interface ItemCarrito {
  producto_id: string
  nombre: string
  codigo_interno: string
  precio_unitario: number
  cantidad: number
  subtotal: number
  stock_disponible: number
}

interface CajaRow {
  id: string
  sucursal_id: string
  estado: 'abierta' | 'cerrada'
}

interface VentaCreada {
  id: string
  total: number
  subtotal: number
  descuento: number
  medio_pago: MedioPago
  cliente_nombre?: string | null
  created_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MEDIO_PAGO_OPTIONS: { value: MedioPago; label: string; emoji: string }[] = [
  { value: 'efectivo',      label: 'Efectivo',      emoji: '💵' },
  { value: 'yape',          label: 'Yape',          emoji: '🟣' },
  { value: 'plin',          label: 'Plin',          emoji: '🔵' },
  { value: 'tarjeta',       label: 'Tarjeta',       emoji: '💳' },
  { value: 'transferencia', label: 'Transferencia', emoji: '🏦' },
  { value: 'credito',       label: 'Crédito',       emoji: '📋' },
]

const STOCK_BADGE: Record<'ok' | 'bajo' | 'agotado', { label: string; badgeClass: string; textClass: string }> = {
  ok:      { label: 'En stock',   badgeClass: 'bg-green-100 text-green-700',  textClass: 'text-green-600' },
  bajo:    { label: 'Stock bajo', badgeClass: 'bg-yellow-100 text-yellow-700', textClass: 'text-yellow-600' },
  agotado: { label: 'Agotado',   badgeClass: 'bg-red-100 text-red-700',       textClass: 'text-red-600' },
}

// ─── Receipt Modal ────────────────────────────────────────────────────────────

interface ReceiptModalProps {
  venta: VentaCreada
  items: ItemCarrito[]
  vendedorNombre: string
  onNuevaVenta: () => void
}

function ReceiptModal({ venta, items, vendedorNombre, onNuevaVenta }: ReceiptModalProps) {
  const medioCfg = MEDIO_PAGO_OPTIONS.find((m) => m.value === venta.medio_pago)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <style>{`
        @media print {
          body > *:not(#receipt-print-root) { display: none !important; }
          #receipt-print-root { display: block !important; position: static !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
        <div id="receipt-print-root" className="overflow-y-auto p-6">
          {/* Header */}
          <div className="text-center mb-5 border-b border-dashed border-gray-300 pb-4">
            <div
              className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-3"
              style={{ background: 'linear-gradient(135deg, #1F3864, #0ea5e9)' }}
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-[#1F3864]">Lubricentro E' Manuel</h2>
            <p className="text-sm text-gray-500">Comprobante de Venta</p>
          </div>

          {/* Sale info */}
          <div className="space-y-1.5 text-sm mb-5">
            <div className="flex justify-between">
              <span className="text-gray-500">Nro. de venta:</span>
              <span className="font-mono font-semibold text-gray-800">
                #{venta.id.slice(0, 8).toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Fecha y hora:</span>
              <span className="text-gray-800">{formatDateTime(venta.created_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Vendedor:</span>
              <span className="text-gray-800">{vendedorNombre}</span>
            </div>
            {venta.cliente_nombre && (
              <div className="flex justify-between">
                <span className="text-gray-500">Cliente:</span>
                <span className="text-gray-800 font-medium">{venta.cliente_nombre}</span>
              </div>
            )}
          </div>

          {/* Items table */}
          <div className="border-t border-dashed border-gray-300 pt-4 mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase">
                  <th className="text-left pb-2">Producto</th>
                  <th className="text-center pb-2">Cant.</th>
                  <th className="text-right pb-2">Precio</th>
                  <th className="text-right pb-2">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item.producto_id}>
                    <td className="py-1.5">
                      <p className="font-medium text-gray-800 leading-tight">{item.nombre}</p>
                      <p className="text-xs text-gray-400 font-mono">{item.codigo_interno}</p>
                    </td>
                    <td className="py-1.5 text-center text-gray-700">{item.cantidad}</td>
                    <td className="py-1.5 text-right text-gray-700">
                      {formatCurrency(item.precio_unitario)}
                    </td>
                    <td className="py-1.5 text-right font-semibold text-gray-800">
                      {formatCurrency(item.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="border-t border-dashed border-gray-300 pt-4 space-y-1.5 text-sm mb-4">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal:</span>
              <span>{formatCurrency(venta.subtotal)}</span>
            </div>
            {venta.descuento > 0 && (
              <div className="flex justify-between text-orange-600">
                <span>Descuento:</span>
                <span>-{formatCurrency(venta.descuento)}</span>
              </div>
            )}
            <div className="flex justify-between text-[#1F3864] font-bold text-lg border-t border-gray-200 pt-2 mt-2">
              <span>TOTAL:</span>
              <span>{formatCurrency(venta.total)}</span>
            </div>
            <div className="flex justify-between text-gray-500 text-xs pt-1">
              <span>Medio de pago:</span>
              <span>
                {medioCfg?.emoji} {medioCfg?.label}
              </span>
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 border-t border-dashed border-gray-200 pt-3">
            ¡Gracias por su compra!
          </p>
        </div>

        {/* Action buttons */}
        <div className="no-print p-4 border-t border-gray-100 flex gap-3 shrink-0">
          <button
            onClick={() => window.print()}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 font-medium transition-colors text-sm"
          >
            🖨️ Imprimir
          </button>
          <button
            onClick={onNuevaVenta}
            className="flex-1 py-2.5 px-4 rounded-xl text-white font-semibold transition-opacity text-sm hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #1F3864, #0ea5e9)' }}
          >
            ✅ Nueva Venta
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Payment Modal ────────────────────────────────────────────────────────────

interface PaymentModalProps {
  total: number
  subtotal: number
  descuento: number
  items: ItemCarrito[]
  clienteId: string | null
  clienteNombre: string | null
  vendedorNombre: string
  onClose: () => void
  onSuccess: (venta: VentaCreada) => void
}

function PaymentModal({
  total,
  subtotal,
  descuento,
  items,
  clienteId,
  clienteNombre,
  onClose,
  onSuccess,
}: PaymentModalProps) {
  const [medioPago, setMedioPago] = useState<MedioPago>('efectivo')
  const [montoRecibido, setMontoRecibido] = useState<number>(total)
  const [observaciones, setObservaciones] = useState('')
  const [loading, setLoading] = useState(false)

  const vuelto = montoRecibido - total
  const isEfectivo = medioPago === 'efectivo'
  const isCredito = medioPago === 'credito'
  const creditoSinCliente = isCredito && !clienteId

  const canConfirm =
    !loading &&
    !creditoSinCliente &&
    (!isEfectivo || montoRecibido >= total)

  async function handleConfirmar() {
    if (!canConfirm) return
    setLoading(true)
    try {
      const p_items = items.map((item) => ({
        producto_id: item.producto_id,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
      }))

      const { data, error } = await supabase.rpc('crear_venta', {
        p_items,
        p_medio_pago: medioPago,
        p_cliente_id: clienteId ?? null,
        p_descuento: descuento,
        p_observaciones: observaciones.trim() || null,
      })

      if (error) throw error

      const result = data as Record<string, unknown>
      const ventaId = (result?.venta_id ?? result?.id ?? '') as string

      onSuccess({
        id: ventaId,
        total,
        subtotal,
        descuento,
        medio_pago: medioPago,
        cliente_nombre: clienteNombre,
        created_at: new Date().toISOString(),
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al registrar la venta'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Cobrar</h2>
            <p className="text-2xl font-bold text-[#1F3864] mt-0.5">{formatCurrency(total)}</p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40"
            aria-label="Cerrar"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-5">
          {/* Medio de pago grid */}
          <div>
            <p className="label-text mb-2">Método de pago</p>
            <div className="grid grid-cols-3 gap-2">
              {MEDIO_PAGO_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setMedioPago(opt.value)}
                  className={cn(
                    'flex flex-col items-center justify-center py-3 px-2 rounded-xl border-2 transition-all font-medium gap-1',
                    medioPago === opt.value
                      ? 'border-[#1F3864] bg-blue-50 text-[#1F3864]'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600 hover:bg-gray-50'
                  )}
                >
                  <span className="text-xl">{opt.emoji}</span>
                  <span className="text-xs">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Efectivo: monto recibido + vuelto */}
          {isEfectivo && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <div>
                <label className="label-text">Monto recibido (S/)</label>
                <input
                  type="number"
                  min={0}
                  step={0.10}
                  value={montoRecibido}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setMontoRecibido(parseFloat(e.target.value) || 0)
                  }
                  className="input-field text-lg font-semibold"
                  autoFocus
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 font-medium">Vuelto:</span>
                <span
                  className={cn(
                    'text-xl font-bold',
                    vuelto >= 0 ? 'text-green-600' : 'text-red-600'
                  )}
                >
                  {formatCurrency(Math.max(0, vuelto))}
                </span>
              </div>
              {vuelto < 0 && (
                <p className="text-xs text-red-600 font-medium">
                  Monto insuficiente — faltan {formatCurrency(Math.abs(vuelto))}
                </p>
              )}
            </div>
          )}

          {/* Crédito warning */}
          {isCredito && (
            <div
              className={cn(
                'rounded-xl p-4 border',
                creditoSinCliente
                  ? 'bg-red-50 border-red-200'
                  : 'bg-green-50 border-green-200'
              )}
            >
              {creditoSinCliente ? (
                <div className="flex items-start gap-2">
                  <svg
                    className="w-5 h-5 text-red-500 mt-0.5 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <p className="text-sm text-red-700 font-medium">
                    Selecciona un cliente para continuar con crédito
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-green-600 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-sm text-green-700 font-medium">
                    Crédito para: <strong>{clienteNombre}</strong>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Observaciones */}
          <div>
            <label className="label-text">Observaciones (opcional)</label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="input-field resize-none"
              rows={2}
              placeholder="Notas adicionales para esta venta..."
            />
          </div>

          {/* Summary */}
          <div className="bg-[#1F3864]/5 rounded-xl p-4 text-sm space-y-1.5">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal:</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {descuento > 0 && (
              <div className="flex justify-between text-orange-600">
                <span>Descuento:</span>
                <span>-{formatCurrency(descuento)}</span>
              </div>
            )}
            <div className="flex justify-between text-[#1F3864] font-bold text-base border-t border-[#1F3864]/20 pt-1.5 mt-1.5">
              <span>TOTAL A COBRAR:</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        {/* Confirm button */}
        <div className="px-5 pb-5 shrink-0">
          <button
            onClick={handleConfirmar}
            disabled={!canConfirm}
            className={cn(
              'w-full py-3.5 rounded-xl text-white font-bold text-base transition-all',
              canConfirm
                ? 'hover:opacity-90 active:scale-[0.98]'
                : 'opacity-40 cursor-not-allowed'
            )}
            style={{ background: 'linear-gradient(135deg, #1F3864, #0ea5e9)' }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Registrando venta...
              </span>
            ) : (
              `Confirmar Venta — ${formatCurrency(total)}`
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Product Card ─────────────────────────────────────────────────────────────

interface ProductCardProps {
  producto: ProductoDetalle
  onClick: () => void
}

function ProductCard({ producto, onClick }: ProductCardProps) {
  const stockCfg = STOCK_BADGE[producto.stock_estado]
  const isAgotado = producto.stock_estado === 'agotado'

  return (
    <button
      onClick={onClick}
      disabled={isAgotado}
      className={cn(
        'text-left w-full bg-white border-2 rounded-xl p-3 transition-all',
        isAgotado
          ? 'opacity-50 cursor-not-allowed border-gray-200'
          : 'border-gray-200 hover:border-[#0ea5e9] hover:shadow-md active:scale-[0.97] cursor-pointer'
      )}
    >
      <div className="flex justify-between items-start gap-2 mb-1">
        <p className="font-semibold text-gray-800 text-sm leading-tight line-clamp-2 flex-1">
          {producto.nombre}
        </p>
        <span className={cn('shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium', stockCfg.badgeClass)}>
          {producto.stock_actual}
        </span>
      </div>
      {producto.marca && (
        <p className="text-xs text-gray-400 mb-1 truncate">{producto.marca}</p>
      )}
      <p className="text-xs font-mono text-gray-400 mb-2">{producto.codigo_interno}</p>
      <p className="text-base font-bold text-[#1F3864]">{formatCurrency(producto.precio_venta)}</p>
      <p className={cn('text-xs mt-0.5', stockCfg.textClass)}>{stockCfg.label}</p>
    </button>
  )
}

// ─── Client Selector ──────────────────────────────────────────────────────────

interface ClienteSelectorProps {
  sucursalId: string
  clienteId: string | null
  clienteNombre: string | null
  onSelect: (id: string, nombre: string) => void
  onClear: () => void
}

function ClienteSelector({
  sucursalId,
  clienteId,
  clienteNombre,
  onSelect,
  onClear,
}: ClienteSelectorProps) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const debouncedSearch = useDebounce(search, 250)
  const containerRef = useRef<HTMLDivElement>(null)

  const { data: clientes = [] } = useQuery<ClienteRow[]>({
    queryKey: ['clientes-search', sucursalId, debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch.trim() || debouncedSearch.trim().length < 2) return []
      const { data, error } = await supabase
        .from('clientes')
        .select('id, sucursal_id, nombre, telefono, tipo, ruc_dni, activo')
        .eq('sucursal_id', sucursalId)
        .eq('activo', true)
        .ilike('nombre', `%${debouncedSearch}%`)
        .limit(8)
      if (error) throw error
      return (data ?? []) as ClienteRow[]
    },
    enabled: !!debouncedSearch.trim() && debouncedSearch.trim().length >= 2,
  })

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (clienteId) {
    return (
      <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
        <svg className="w-4 h-4 text-[#1F3864] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <span className="flex-1 text-sm font-medium text-[#1F3864] truncate">{clienteNombre}</span>
        <button
          onClick={onClear}
          className="text-gray-400 hover:text-red-500 transition-colors"
          aria-label="Quitar cliente"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setSearch(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar cliente..."
          className="input-field pl-9 text-sm"
          autoComplete="off"
        />
      </div>
      {open && clientes.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
          {clientes.map((cliente) => (
            <button
              key={cliente.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect(cliente.id, cliente.nombre)
                setSearch('')
                setOpen(false)
              }}
              className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0"
            >
              <p className="text-sm font-medium text-gray-800">{cliente.nombre}</p>
              {cliente.telefono && (
                <p className="text-xs text-gray-400">{cliente.telefono}</p>
              )}
            </button>
          ))}
        </div>
      )}
      {open && search.trim().length >= 2 && clientes.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 p-3 text-center">
          <p className="text-sm text-gray-400">No se encontraron clientes</p>
        </div>
      )}
    </div>
  )
}

// ─── Cart Item Row ────────────────────────────────────────────────────────────

interface CartItemRowProps {
  item: ItemCarrito
  onQuantityChange: (productoId: string, qty: number) => void
  onPriceChange: (productoId: string, price: number) => void
  onRemove: (productoId: string) => void
}

function CartItemRow({ item, onQuantityChange, onPriceChange, onRemove }: CartItemRowProps) {
  const [editingPrice, setEditingPrice] = useState(false)
  const [priceInput, setPriceInput] = useState(String(item.precio_unitario))

  function commitPrice() {
    const val = parseFloat(priceInput)
    if (!isNaN(val) && val > 0) {
      onPriceChange(item.producto_id, val)
    } else {
      setPriceInput(String(item.precio_unitario))
    }
    setEditingPrice(false)
  }

  return (
    <div className="flex flex-col gap-1.5 py-2.5 border-b border-gray-100 last:border-0">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 leading-tight truncate">{item.nombre}</p>
          <p className="text-xs text-gray-400 font-mono">{item.codigo_interno}</p>
        </div>
        <button
          onClick={() => onRemove(item.producto_id)}
          className="text-gray-300 hover:text-red-500 transition-colors shrink-0 mt-0.5"
          aria-label="Quitar"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex items-center justify-between gap-2">
        {/* Quantity controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onQuantityChange(item.producto_id, item.cantidad - 1)}
            disabled={item.cantidad <= 1}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-base font-bold leading-none"
          >
            −
          </button>
          <input
            type="number"
            min={1}
            max={item.stock_disponible}
            value={item.cantidad}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              const val = parseInt(e.target.value, 10)
              if (!isNaN(val) && val >= 1) onQuantityChange(item.producto_id, val)
            }}
            className="w-12 text-center text-sm font-semibold border border-gray-300 rounded-lg py-1 focus:outline-none focus:ring-1 focus:ring-[#0ea5e9] focus:border-[#0ea5e9]"
          />
          <button
            onClick={() => onQuantityChange(item.producto_id, item.cantidad + 1)}
            disabled={item.cantidad >= item.stock_disponible}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-base font-bold leading-none"
          >
            +
          </button>
        </div>

        {/* Price (editable) and subtotal */}
        <div className="text-right">
          {editingPrice ? (
            <input
              type="number"
              min={0}
              step={0.01}
              value={priceInput}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setPriceInput(e.target.value)}
              onBlur={commitPrice}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                if (e.key === 'Enter') commitPrice()
                if (e.key === 'Escape') {
                  setPriceInput(String(item.precio_unitario))
                  setEditingPrice(false)
                }
              }}
              className="w-24 text-right text-sm border border-[#0ea5e9] rounded-lg py-0.5 px-1.5 focus:outline-none focus:ring-1 focus:ring-[#0ea5e9]"
              autoFocus
            />
          ) : (
            <button
              onClick={() => {
                setPriceInput(String(item.precio_unitario))
                setEditingPrice(true)
              }}
              title="Haz clic para editar el precio"
              className="text-sm text-gray-500 hover:text-[#1F3864] hover:underline underline-offset-2 transition-colors"
            >
              {formatCurrency(item.precio_unitario)}
            </button>
          )}
          <p className="text-sm font-bold text-[#1F3864]">{formatCurrency(item.subtotal)}</p>
        </div>
      </div>
    </div>
  )
}

// ─── Main POS Page ────────────────────────────────────────────────────────────

export default function NuevaVentaPage() {
  const { user } = useAuth()
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Mobile tab
  const [mobileTab, setMobileTab] = useState<'productos' | 'carrito'>('productos')

  // Search
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearch = useDebounce(searchTerm, 250)

  // Cart
  const [carrito, setCarrito] = useState<ItemCarrito[]>([])
  const [descuento, setDescuento] = useState<number>(0)
  const [clienteId, setClienteId] = useState<string | null>(null)
  const [clienteNombre, setClienteNombre] = useState<string | null>(null)

  // Modals
  const [showPayment, setShowPayment] = useState(false)
  const [ventaCreada, setVentaCreada] = useState<VentaCreada | null>(null)
  const [itemsParaRecibo, setItemsParaRecibo] = useState<ItemCarrito[]>([])

  // ── Caja check ──────────────────────────────────────────────────────────────

  const { data: caja, isLoading: cajaLoading } = useQuery<CajaRow | null>({
    queryKey: ['caja-activa', user?.sucursal_id],
    queryFn: async () => {
      if (!user?.sucursal_id) return null
      const { data, error } = await supabase
        .from('cajas')
        .select('id, sucursal_id, estado')
        .eq('sucursal_id', user.sucursal_id)
        .eq('estado', 'abierta')
        .maybeSingle()
      if (error) throw error
      return data as CajaRow | null
    },
    enabled: !!user?.sucursal_id,
  })

  // ── Products query ───────────────────────────────────────────────────────────

  const isBarcode = /^\d{8,}$/.test(debouncedSearch.trim())

  const { data: productos = [], isFetching: productosLoading } = useQuery<ProductoDetalle[]>({
    queryKey: ['productos-pos', user?.sucursal_id, debouncedSearch],
    queryFn: async () => {
      if (!user?.sucursal_id) return []

      let query = supabase
        .from('vw_productos_detalle')
        .select(
          'id,sucursal_id,codigo_interno,codigo_barras,nombre,marca,viscosidad_especificacion,precio_venta,costo,stock_actual,stock_minimo,tiene_codigo_barras,foto_url,activo,categoria_nombre,stock_estado'
        )
        .eq('sucursal_id', user.sucursal_id)
        .eq('activo', true)

      const term = debouncedSearch.trim()
      if (term) {
        if (isBarcode) {
          query = query.eq('codigo_barras', term)
        } else {
          query = query.or(
            `nombre.ilike.%${term}%,codigo_interno.ilike.%${term}%,marca.ilike.%${term}%`
          )
        }
      }

      const { data, error } = await query
        .order('nombre', { ascending: true })
        .limit(term ? 50 : 20)

      if (error) throw error
      return (data ?? []) as ProductoDetalle[]
    },
    enabled: !!user?.sucursal_id,
    staleTime: 30_000,
  })

  // Autofocus
  useEffect(() => {
    searchInputRef.current?.focus()
  }, [])

  // ── Cart helpers ─────────────────────────────────────────────────────────────

  const addToCart = useCallback((producto: ProductoDetalle) => {
    if (producto.stock_actual <= 0) {
      toast.error('Sin stock disponible')
      return
    }
    setCarrito((prev) => {
      const existing = prev.find((i) => i.producto_id === producto.id)
      if (existing) {
        if (existing.cantidad >= producto.stock_actual) {
          toast.warning(`Stock máximo disponible: ${producto.stock_actual}`)
          return prev
        }
        return prev.map((i) =>
          i.producto_id === producto.id
            ? {
                ...i,
                cantidad: i.cantidad + 1,
                subtotal: (i.cantidad + 1) * i.precio_unitario,
              }
            : i
        )
      }
      return [
        ...prev,
        {
          producto_id: producto.id,
          nombre: producto.nombre,
          codigo_interno: producto.codigo_interno,
          precio_unitario: producto.precio_venta,
          cantidad: 1,
          subtotal: producto.precio_venta,
          stock_disponible: producto.stock_actual,
        },
      ]
    })
    setMobileTab('carrito')
  }, [])

  function handleQuantityChange(productoId: string, qty: number) {
    setCarrito((prev) =>
      prev.map((i) => {
        if (i.producto_id !== productoId) return i
        const clamped = Math.min(Math.max(1, qty), i.stock_disponible)
        return { ...i, cantidad: clamped, subtotal: clamped * i.precio_unitario }
      })
    )
  }

  function handlePriceChange(productoId: string, price: number) {
    setCarrito((prev) =>
      prev.map((i) =>
        i.producto_id === productoId
          ? { ...i, precio_unitario: price, subtotal: price * i.cantidad }
          : i
      )
    )
  }

  function handleRemove(productoId: string) {
    setCarrito((prev) => prev.filter((i) => i.producto_id !== productoId))
  }

  function handleSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      const first = productos[0]
      if (first) {
        addToCart(first)
        setSearchTerm('')
      }
    }
  }

  function clearAll() {
    setCarrito([])
    setDescuento(0)
    setClienteId(null)
    setClienteNombre(null)
    setVentaCreada(null)
    setItemsParaRecibo([])
    setShowPayment(false)
    setSearchTerm('')
    setMobileTab('productos')
    setTimeout(() => searchInputRef.current?.focus(), 50)
  }

  // ── Totals ───────────────────────────────────────────────────────────────────

  const subtotal = carrito.reduce((s, i) => s + i.subtotal, 0)
  const descuentoClamp = Math.min(Math.max(0, descuento), subtotal)
  const total = Math.max(0, subtotal - descuentoClamp)
  const totalItems = carrito.reduce((s, i) => s + i.cantidad, 0)

  // ── Caja gate ────────────────────────────────────────────────────────────────

  if (cajaLoading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="flex items-center gap-3 text-gray-500">
          <svg className="animate-spin w-6 h-6 text-[#1F3864]" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span>Verificando caja...</span>
        </div>
      </div>
    )
  }

  if (!caja) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="card p-10 w-full max-w-md text-center shadow-lg">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-5"
            style={{ background: 'linear-gradient(135deg, #fee2e2, #fca5a5)' }}
          >
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">No hay caja abierta</h2>
          <p className="text-gray-500 mb-6 text-sm leading-relaxed">
            Para realizar ventas debes abrir la caja primero.
            Ve a Gestión de Caja para abrir una.
          </p>
          <Link
            to="/caja"
            className="inline-flex items-center gap-2 py-3 px-6 rounded-xl text-white font-semibold text-sm transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #1F3864, #0ea5e9)' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
              />
            </svg>
            Ir a Gestión de Caja
          </Link>
        </div>
      </div>
    )
  }

  // ── Main POS layout ──────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-[#f1f5f9] overflow-hidden">
      {/* Mobile tab switcher */}
      <div className="lg:hidden flex bg-white border-b border-gray-200 p-2 gap-2 shrink-0">
        <button
          onClick={() => setMobileTab('productos')}
          className={cn(
            'flex-1 py-2 rounded-lg text-sm font-semibold transition-all',
            mobileTab === 'productos' ? 'text-white' : 'text-gray-600 hover:bg-gray-100'
          )}
          style={
            mobileTab === 'productos'
              ? { background: 'linear-gradient(135deg, #1F3864, #0ea5e9)' }
              : {}
          }
        >
          Productos
        </button>
        <button
          onClick={() => setMobileTab('carrito')}
          className={cn(
            'flex-1 py-2 rounded-lg text-sm font-semibold transition-all',
            mobileTab === 'carrito' ? 'text-white' : 'text-gray-600 hover:bg-gray-100'
          )}
          style={
            mobileTab === 'carrito'
              ? { background: 'linear-gradient(135deg, #1F3864, #0ea5e9)' }
              : {}
          }
        >
          Carrito
          {totalItems > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold">
              {totalItems > 9 ? '9+' : totalItems}
            </span>
          )}
        </button>
      </div>

      {/* Main columns */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT: Products */}
        <div
          className={cn(
            'flex flex-col flex-1 overflow-hidden',
            mobileTab === 'carrito' ? 'hidden lg:flex' : 'flex'
          )}
        >
          {/* Search bar */}
          <div className="bg-white p-3 border-b border-gray-200 shrink-0">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Buscar por nombre, código o marca... (Enter agrega el primero)"
                className="input-field pl-9 pr-20 text-sm"
                autoComplete="off"
              />
              {searchTerm && (
                <button
                  onClick={() => {
                    setSearchTerm('')
                    searchInputRef.current?.focus()
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 font-medium transition-colors"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>

          {/* Product grid */}
          <div className="flex-1 overflow-y-auto p-3">
            {productosLoading && productos.length === 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="h-28 bg-white rounded-xl animate-pulse" />
                ))}
              </div>
            ) : productos.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <svg
                  className="w-10 h-10 text-gray-300 mb-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <p className="text-gray-500 font-medium text-sm">No se encontraron productos</p>
                {debouncedSearch && (
                  <p className="text-gray-400 text-xs mt-1">
                    Sin resultados para "{debouncedSearch}"
                  </p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                {productos.map((p) => (
                  <ProductCard key={p.id} producto={p} onClick={() => addToCart(p)} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Cart */}
        <div
          className={cn(
            'flex flex-col bg-white border-l border-gray-200 overflow-hidden',
            'w-full lg:w-96 shrink-0',
            mobileTab === 'productos' ? 'hidden lg:flex' : 'flex'
          )}
        >
          {/* Cart header */}
          <div className="p-4 border-b border-gray-100 shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-800 text-base">
                Carrito
                {totalItems > 0 && (
                  <span className="ml-2 text-xs font-semibold text-[#1F3864] bg-[#1F3864]/10 px-2 py-0.5 rounded-full">
                    {totalItems} {totalItems === 1 ? 'item' : 'items'}
                  </span>
                )}
              </h2>
              {carrito.length > 0 && (
                <button
                  onClick={() => {
                    setCarrito([])
                    setDescuento(0)
                  }}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors font-medium"
                >
                  Vaciar
                </button>
              )}
            </div>
          </div>

          {/* Items list */}
          <div className="flex-1 overflow-y-auto px-4">
            {carrito.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-10">
                <svg
                  className="w-12 h-12 text-gray-200 mb-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                <p className="text-gray-400 text-sm font-medium">El carrito está vacío</p>
                <p className="text-gray-300 text-xs mt-1">Busca y agrega productos</p>
              </div>
            ) : (
              <div>
                {carrito.map((item) => (
                  <CartItemRow
                    key={item.producto_id}
                    item={item}
                    onQuantityChange={handleQuantityChange}
                    onPriceChange={handlePriceChange}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Cart footer */}
          <div className="border-t border-gray-100 p-4 space-y-3 shrink-0">
            {/* Client selector */}
            <div>
              <p className="label-text mb-1.5">Cliente (opcional)</p>
              <ClienteSelector
                sucursalId={user?.sucursal_id ?? ''}
                clienteId={clienteId}
                clienteNombre={clienteNombre}
                onSelect={(id, nombre) => {
                  setClienteId(id)
                  setClienteNombre(nombre)
                }}
                onClear={() => {
                  setClienteId(null)
                  setClienteNombre(null)
                }}
              />
            </div>

            {/* Discount */}
            <div>
              <label className="label-text">Descuento (S/)</label>
              <input
                type="number"
                min={0}
                max={subtotal}
                step={0.50}
                value={descuento || ''}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  const val = parseFloat(e.target.value) || 0
                  setDescuento(Math.max(0, Math.min(val, subtotal)))
                }}
                placeholder="0.00"
                className="input-field text-sm"
              />
            </div>

            {/* Totals */}
            <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal:</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {descuentoClamp > 0 && (
                <div className="flex justify-between text-orange-600">
                  <span>Descuento:</span>
                  <span>−{formatCurrency(descuentoClamp)}</span>
                </div>
              )}
              <div className="flex justify-between text-[#1F3864] font-bold text-lg border-t border-gray-200 pt-1.5 mt-0.5">
                <span>TOTAL:</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>

            {/* COBRAR button */}
            <button
              onClick={() => setShowPayment(true)}
              disabled={carrito.length === 0}
              className={cn(
                'w-full py-3.5 rounded-xl text-white font-bold text-base transition-all',
                carrito.length > 0
                  ? 'hover:opacity-90 active:scale-[0.98]'
                  : 'opacity-40 cursor-not-allowed'
              )}
              style={{ background: 'linear-gradient(135deg, #1F3864, #0ea5e9)' }}
            >
              {carrito.length === 0 ? 'COBRAR' : `COBRAR ${formatCurrency(total)}`}
            </button>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPayment && (
        <PaymentModal
          total={total}
          subtotal={subtotal}
          descuento={descuentoClamp}
          items={carrito}
          clienteId={clienteId}
          clienteNombre={clienteNombre}
          vendedorNombre={user?.nombre ?? ''}
          onClose={() => setShowPayment(false)}
          onSuccess={(venta) => {
            setShowPayment(false)
            setItemsParaRecibo([...carrito])
            setVentaCreada(venta)
            toast.success('Venta registrada exitosamente')
          }}
        />
      )}

      {/* Receipt Modal */}
      {ventaCreada && (
        <ReceiptModal
          venta={ventaCreada}
          items={itemsParaRecibo}
          vendedorNombre={user?.nombre ?? ''}
          onNuevaVenta={clearAll}
        />
      )}
    </div>
  )
}
