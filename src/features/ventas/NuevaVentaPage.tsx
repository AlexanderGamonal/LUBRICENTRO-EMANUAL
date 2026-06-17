import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import { formatCurrency } from '@/shared/utils/formatters'
import { cn } from '@/shared/utils/cn'
import type { MedioPago } from '@/shared/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductoBusqueda {
  id: string
  codigo_interno: string
  codigo_barras: string | null
  nombre: string
  marca: string | null
  precio_venta: number
  stock_actual: number
  stock_minimo: number
  categoria_nombre: string | null
}

interface CartItem {
  producto_id: string
  codigo_interno: string
  nombre: string
  precio_unitario: number
  cantidad: number
  stock_actual: number
}

interface ClienteBusqueda {
  id: string
  nombre: string
  telefono: string | null
  ruc_dni: string | null
}

const MEDIOS_PAGO: { value: MedioPago; label: string; icon: string }[] = [
  { value: 'efectivo', label: 'Efectivo', icon: '💵' },
  { value: 'yape', label: 'Yape', icon: '📱' },
  { value: 'plin', label: 'Plin', icon: '📲' },
  { value: 'tarjeta', label: 'Tarjeta', icon: '💳' },
  { value: 'transferencia', label: 'Transfer.', icon: '🏦' },
  { value: 'credito', label: 'Crédito', icon: '📋' },
]

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debouncedValue
}

function useCajaActiva(sucursalId: string | undefined) {
  return useQuery({
    queryKey: ['caja-activa', sucursalId],
    queryFn: async () => {
      if (!sucursalId) return null
      const { data, error } = await supabase
        .from('cajas')
        .select('id, estado')
        .eq('sucursal_id', sucursalId)
        .eq('estado', 'abierta')
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!sucursalId,
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NuevaVentaPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([])
  const [medioPago, setMedioPago] = useState<MedioPago>('efectivo')
  const [descuento, setDescuento] = useState(0)
  const [observaciones, setObservaciones] = useState('')
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteBusqueda | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Search state
  const [searchTerm, setSearchTerm] = useState('')
  const [showResults, setShowResults] = useState(false)
  const debouncedSearch = useDebounce(searchTerm, 200)

  // Client search
  const [clienteSearch, setClienteSearch] = useState('')
  const [showClienteResults, setShowClienteResults] = useState(false)
  const debouncedClienteSearch = useDebounce(clienteSearch, 300)

  const { data: caja } = useCajaActiva(user?.sucursal_id)

  // Product search query
  const { data: productosEncontrados = [] } = useQuery<ProductoBusqueda[]>({
    queryKey: ['busqueda-pos', debouncedSearch],
    queryFn: async () => {
      if (debouncedSearch.length < 2) return []
      const term = debouncedSearch.trim()
      const { data, error } = await supabase
        .from('vw_productos_detalle')
        .select('id, codigo_interno, codigo_barras, nombre, marca, precio_venta, stock_actual, stock_minimo, categoria_nombre')
        .eq('activo', true)
        .or(`nombre.ilike.%${term}%,codigo_interno.ilike.%${term}%,codigo_barras.eq.${term}`)
        .order('nombre')
        .limit(10)
      if (error) throw error
      return (data ?? []) as ProductoBusqueda[]
    },
    enabled: debouncedSearch.length >= 2,
  })

  // Client search query
  const { data: clientesEncontrados = [] } = useQuery<ClienteBusqueda[]>({
    queryKey: ['busqueda-clientes-pos', debouncedClienteSearch],
    queryFn: async () => {
      if (debouncedClienteSearch.length < 2) return []
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nombre, telefono, ruc_dni')
        .eq('activo', true)
        .or(`nombre.ilike.%${debouncedClienteSearch}%,telefono.ilike.%${debouncedClienteSearch}%`)
        .limit(8)
      if (error) throw error
      return (data ?? []) as ClienteBusqueda[]
    },
    enabled: debouncedClienteSearch.length >= 2,
  })

  // Barcode scanner: detect fast consecutive keystrokes
  const barcodeBuffer = useRef('')
  const barcodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const now = Date.now()
    if (!barcodeTimerRef.current) {
      barcodeBuffer.current = ''
    }
    if (barcodeTimerRef.current) clearTimeout(barcodeTimerRef.current)

    if (e.key === 'Enter') {
      const barcode = barcodeBuffer.current
      barcodeBuffer.current = ''
      if (barcode.length > 3) {
        // likely scanner input — search directly
        setSearchTerm(barcode)
      }
      return
    }

    barcodeBuffer.current += e.key
    barcodeTimerRef.current = setTimeout(() => {
      barcodeBuffer.current = ''
      barcodeTimerRef.current = null
    }, 80)

    void now
  }, [])

  // Cart operations
  function addToCart(producto: ProductoBusqueda) {
    setCart(prev => {
      const existing = prev.find(i => i.producto_id === producto.id)
      if (existing) {
        if (existing.cantidad >= producto.stock_actual) {
          toast.error(`Stock insuficiente. Máximo: ${producto.stock_actual}`)
          return prev
        }
        return prev.map(i =>
          i.producto_id === producto.id
            ? { ...i, cantidad: i.cantidad + 1 }
            : i
        )
      }
      if (producto.stock_actual <= 0) {
        toast.error('Producto sin stock')
        return prev
      }
      return [
        ...prev,
        {
          producto_id: producto.id,
          codigo_interno: producto.codigo_interno,
          nombre: producto.nombre,
          precio_unitario: producto.precio_venta,
          cantidad: 1,
          stock_actual: producto.stock_actual,
        },
      ]
    })
    setSearchTerm('')
    setShowResults(false)
    searchInputRef.current?.focus()
  }

  function removeFromCart(productoId: string) {
    setCart(prev => prev.filter(i => i.producto_id !== productoId))
  }

  function updateCantidad(productoId: string, cantidad: number) {
    if (cantidad < 1) return
    setCart(prev =>
      prev.map(i => {
        if (i.producto_id !== productoId) return i
        if (cantidad > i.stock_actual) {
          toast.error(`Stock máximo: ${i.stock_actual}`)
          return i
        }
        return { ...i, cantidad }
      })
    )
  }

  function updatePrecio(productoId: string, precio: number) {
    if (precio < 0) return
    setCart(prev =>
      prev.map(i => i.producto_id === productoId ? { ...i, precio_unitario: precio } : i)
    )
  }

  // Totals
  const subtotal = cart.reduce((acc, i) => acc + i.precio_unitario * i.cantidad, 0)
  const total = Math.max(0, subtotal - descuento)

  // Submit sale
  async function handleSubmit() {
    if (cart.length === 0) {
      toast.error('Agrega al menos un producto')
      return
    }
    if (!caja) {
      toast.error('Debes abrir la caja antes de vender')
      return
    }

    setSubmitting(true)
    try {
      const items = cart.map(i => ({
        producto_id: i.producto_id,
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
      }))

      const { data, error } = await supabase.rpc('crear_venta', {
        p_items: items,
        p_medio_pago: medioPago,
        p_cliente_id: clienteSeleccionado?.id ?? null,
        p_descuento: descuento,
        p_observaciones: observaciones || null,
      })

      if (error) throw error

      const result = data as { success?: boolean; error?: string; venta_id?: string }
      if (result?.error) throw new Error(result.error)

      toast.success('¡Venta registrada con éxito!')
      queryClient.invalidateQueries({ queryKey: ['ventas'] })
      queryClient.invalidateQueries({ queryKey: ['caja-activa'] })
      queryClient.invalidateQueries({ queryKey: ['productos'] })

      // Reset
      setCart([])
      setDescuento(0)
      setObservaciones('')
      setClienteSeleccionado(null)
      setMedioPago('efectivo')
      searchInputRef.current?.focus()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al registrar la venta'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // Auto-focus search on mount
  useEffect(() => {
    searchInputRef.current?.focus()
  }, [])

  const cajaAbierta = !!caja

  return (
    <div className="h-full flex flex-col md:flex-row gap-0 overflow-hidden bg-slate-50">
      {/* ── Left: Product Search + Cart ────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Search bar */}
        <div className="px-4 pt-4 pb-3 bg-white border-b border-gray-100 shadow-sm">
          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <SearchIcon className="w-4 h-4 text-gray-400" />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value)
                setShowResults(true)
              }}
              onKeyDown={handleSearchKeyDown}
              onFocus={() => setShowResults(true)}
              onBlur={() => setTimeout(() => setShowResults(false), 150)}
              placeholder="Buscar producto por nombre, código o escanear código de barras…"
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-400 focus:border-accent-400 bg-gray-50"
            />
            {searchTerm && (
              <button
                onClick={() => { setSearchTerm(''); setShowResults(false) }}
                className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                <XIcon className="w-4 h-4" />
              </button>
            )}

            {/* Dropdown results */}
            {showResults && searchTerm.length >= 2 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-72 overflow-y-auto">
                {productosEncontrados.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-gray-400 text-center">
                    Sin resultados para "{searchTerm}"
                  </p>
                ) : (
                  productosEncontrados.map(p => (
                    <button
                      key={p.id}
                      onMouseDown={() => addToCart(p)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent-50 transition-colors text-left border-b border-gray-50 last:border-0"
                    >
                      <div className="w-8 h-8 rounded-lg bg-accent-100 flex items-center justify-center flex-shrink-0">
                        <PackageIcon className="w-4 h-4 text-accent-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{p.nombre}</p>
                        <p className="text-xs text-gray-400">{p.codigo_interno} · {p.categoria_nombre ?? '—'}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-gray-800">{formatCurrency(p.precio_venta)}</p>
                        <p className={cn(
                          'text-xs font-medium',
                          p.stock_actual === 0 ? 'text-red-500' :
                          p.stock_actual <= p.stock_minimo ? 'text-amber-500' : 'text-emerald-600'
                        )}>
                          Stock: {p.stock_actual}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Cart */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                <CartIcon className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-gray-400 font-medium">El carrito está vacío</p>
              <p className="text-xs text-gray-300 mt-1">Busca productos arriba o escanea un código</p>
            </div>
          ) : (
            cart.map((item, idx) => (
              <div
                key={item.producto_id}
                className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="w-7 h-7 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary-700">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{item.nombre}</p>
                  <p className="text-xs text-gray-400">{item.codigo_interno}</p>
                </div>

                {/* Price (editable) */}
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-400">S/</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.precio_unitario}
                    onChange={e => updatePrecio(item.producto_id, parseFloat(e.target.value) || 0)}
                    className="w-20 text-sm font-semibold text-right border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent-400"
                  />
                </div>

                {/* Quantity */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => updateCantidad(item.producto_id, item.cantidad - 1)}
                    className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 font-bold text-sm transition-colors"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm font-bold text-gray-800">{item.cantidad}</span>
                  <button
                    onClick={() => updateCantidad(item.producto_id, item.cantidad + 1)}
                    className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 font-bold text-sm transition-colors"
                  >
                    +
                  </button>
                </div>

                {/* Subtotal */}
                <div className="w-24 text-right">
                  <p className="text-sm font-bold text-gray-900">
                    {formatCurrency(item.precio_unitario * item.cantidad)}
                  </p>
                </div>

                {/* Remove */}
                <button
                  onClick={() => removeFromCart(item.producto_id)}
                  className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Right: Summary + Payment ────────────────── */}
      <div
        className="w-full md:w-80 lg:w-96 flex flex-col border-t md:border-t-0 md:border-l border-gray-200 bg-white"
        style={{ minHeight: 0 }}
      >
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Caja warning */}
          {!cajaAbierta && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
              <span className="text-amber-500 text-lg leading-none mt-0.5">⚠️</span>
              <div>
                <p className="text-xs font-semibold text-amber-700">Caja cerrada</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Abre la caja antes de vender.{' '}
                  <button onClick={() => navigate('/caja')} className="underline font-semibold">
                    Ir a Caja
                  </button>
                </p>
              </div>
            </div>
          )}

          {/* Cliente */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Cliente (opcional)
            </label>
            {clienteSeleccionado ? (
              <div className="mt-1.5 flex items-center gap-2 bg-accent-50 border border-accent-200 rounded-xl px-3 py-2">
                <div className="w-7 h-7 rounded-full bg-accent-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {clienteSeleccionado.nombre.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{clienteSeleccionado.nombre}</p>
                  {clienteSeleccionado.telefono && (
                    <p className="text-xs text-gray-500">{clienteSeleccionado.telefono}</p>
                  )}
                </div>
                <button
                  onClick={() => { setClienteSeleccionado(null); setClienteSearch('') }}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <XIcon className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative mt-1.5">
                <input
                  type="text"
                  value={clienteSearch}
                  onChange={e => { setClienteSearch(e.target.value); setShowClienteResults(true) }}
                  onFocus={() => setShowClienteResults(true)}
                  onBlur={() => setTimeout(() => setShowClienteResults(false), 150)}
                  placeholder="Buscar cliente…"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent-400"
                />
                {showClienteResults && clienteSearch.length >= 2 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-48 overflow-y-auto">
                    {clientesEncontrados.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-gray-400 text-center">Sin resultados</p>
                    ) : (
                      clientesEncontrados.map(c => (
                        <button
                          key={c.id}
                          onMouseDown={() => {
                            setClienteSeleccionado(c)
                            setClienteSearch('')
                            setShowClienteResults(false)
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-accent-50 transition-colors border-b border-gray-50 last:border-0"
                        >
                          <p className="text-sm font-medium text-gray-800">{c.nombre}</p>
                          {c.telefono && <p className="text-xs text-gray-400">{c.telefono}</p>}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Payment method */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Medio de pago
            </label>
            <div className="grid grid-cols-3 gap-1.5 mt-1.5">
              {MEDIOS_PAGO.map(m => (
                <button
                  key={m.value}
                  onClick={() => setMedioPago(m.value)}
                  className={cn(
                    'flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl text-xs font-semibold border-2 transition-all',
                    medioPago === m.value
                      ? 'border-accent-500 bg-accent-50 text-accent-700'
                      : 'border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200'
                  )}
                >
                  <span className="text-base">{m.icon}</span>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Discount */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Descuento
            </label>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-sm text-gray-500 font-medium">S/</span>
              <input
                type="number"
                min="0"
                max={subtotal}
                step="0.50"
                value={descuento}
                onChange={e => setDescuento(Math.min(parseFloat(e.target.value) || 0, subtotal))}
                className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent-400"
              />
            </div>
          </div>

          {/* Observaciones */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Observaciones
            </label>
            <textarea
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
              rows={2}
              placeholder="Nota opcional…"
              className="mt-1.5 w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent-400 resize-none"
            />
          </div>
        </div>

        {/* Total + Submit */}
        <div className="p-4 border-t border-gray-100 space-y-3 bg-white">
          {/* Summary lines */}
          <div className="space-y-1">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Subtotal ({cart.reduce((a, i) => a + i.cantidad, 0)} ítems)</span>
              <span className="font-medium text-gray-700">{formatCurrency(subtotal)}</span>
            </div>
            {descuento > 0 && (
              <div className="flex justify-between text-sm text-emerald-600">
                <span>Descuento</span>
                <span>− {formatCurrency(descuento)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-100">
              <span>Total</span>
              <span style={{ color: '#0ea5e9' }}>{formatCurrency(total)}</span>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting || cart.length === 0 || !cajaAbierta}
            className={cn(
              'w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all',
              submitting || cart.length === 0 || !cajaAbierta
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-accent-500 hover:bg-accent-600 active:bg-accent-700 text-white shadow-lg hover:shadow-xl'
            )}
          >
            {submitting ? (
              <>
                <SpinnerIcon className="w-4 h-4 animate-spin" />
                Registrando…
              </>
            ) : (
              <>
                <CheckIcon className="w-4 h-4" />
                Cobrar {formatCurrency(total)}
              </>
            )}
          </button>

          <button
            onClick={() => { setCart([]); setDescuento(0); setObservaciones(''); setClienteSeleccionado(null) }}
            disabled={cart.length === 0}
            className="w-full py-2 rounded-xl text-sm text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-0"
          >
            Limpiar carrito
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Icons ───────────────────────────────────────────────────────────────────── */
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )
}
function PackageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  )
}
function CartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  )
}
function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}
function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  )
}
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}
function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  )
}
