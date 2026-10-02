import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowRight, PackageSearch, Search, ShoppingCart, Wallet, X } from 'lucide-react'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { formatCurrency } from '@/shared/utils/formatters'
import { Button, EmptyState, SegmentedControl, Skeleton } from '@/shared/ui'
import { CartPanel } from './pos/CartPanel'
import { PaymentModal } from './pos/PaymentModal'
import { ProductCard } from './pos/ProductCard'
import { ReceiptModal } from './pos/ReceiptModal'
import { usePosCart } from './pos/usePosCart'
import type { CajaRow, ItemCarrito, ProductoDetalle, VentaCreada } from './pos/constants'

type MobileTab = 'productos' | 'carrito'

export default function NuevaVentaPage() {
  const { user } = useAuth()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const canLowerPrice = user?.rol === 'admin' || user?.rol === 'superadmin'

  const [mobileTab, setMobileTab] = useState<MobileTab>('productos')
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearch = useDebounce(searchTerm, 250)

  const cart = usePosCart(canLowerPrice)
  const [clienteId, setClienteId] = useState<string | null>(null)
  const [clienteNombre, setClienteNombre] = useState<string | null>(null)

  const [showPayment, setShowPayment] = useState(false)
  const [ventaCreada, setVentaCreada] = useState<VentaCreada | null>(null)
  const [itemsParaRecibo, setItemsParaRecibo] = useState<ItemCarrito[]>([])

  // ── Caja ────────────────────────────────────────────────────────────────────
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

  // ── Productos ───────────────────────────────────────────────────────────────
  const isBarcode = /^\d{8,}$/.test(debouncedSearch.trim())

  const { data: productos = [], isFetching: productosLoading } = useQuery<ProductoDetalle[]>({
    queryKey: ['productos-pos', user?.sucursal_id, debouncedSearch],
    queryFn: async () => {
      if (!user?.sucursal_id) return []

      let query = supabase
        .from('vw_productos_detalle')
        .select(
          'id,sucursal_id,codigo_interno,codigo_barras,nombre,marca,viscosidad_especificacion,precio_venta,costo,stock_actual,stock_minimo,tiene_codigo_barras,foto_url,activo,categoria_nombre,stock_estado',
        )
        .eq('sucursal_id', user.sucursal_id)
        .eq('activo', true)

      const term = debouncedSearch.trim()
      if (term) {
        if (isBarcode) {
          query = query.eq('codigo_barras', term)
        } else {
          query = query.or(`nombre.ilike.%${term}%,codigo_interno.ilike.%${term}%,marca.ilike.%${term}%`)
        }
      }

      const { data, error } = await query.order('nombre', { ascending: true }).limit(term ? 50 : 20)
      if (error) throw error
      return (data ?? []) as ProductoDetalle[]
    },
    enabled: !!user?.sucursal_id,
    staleTime: 30_000,
  })

  // En PC el cursor empieza en el buscador (lector de código de barras); en celular no, para no abrir el teclado solo.
  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches) searchInputRef.current?.focus()
  }, [caja])

  function handleSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      const first = productos[0]
      if (first) {
        cart.addToCart(first)
        setSearchTerm('')
      }
    }
  }

  function clearAll() {
    cart.empty()
    setClienteId(null)
    setClienteNombre(null)
    setVentaCreada(null)
    setItemsParaRecibo([])
    setShowPayment(false)
    setSearchTerm('')
    setMobileTab('productos')
    setTimeout(() => {
      if (window.matchMedia('(pointer: fine)').matches) searchInputRef.current?.focus()
    }, 50)
  }

  // ── Compuerta de caja ───────────────────────────────────────────────────────
  if (cajaLoading) {
    return (
      <div role="status" className="flex h-full items-center justify-center p-8 text-sm text-fg-muted">
        Verificando caja…
      </div>
    )
  }

  if (!caja) {
    return (
      <div className="flex h-full items-center justify-center p-4 sm:p-6">
        <div className="card w-full max-w-md">
          <EmptyState
            icon={Wallet}
            title="No hay caja abierta"
            description="Para registrar ventas primero debes abrir la caja del turno."
            action={
              <Link to="/caja" className="btn-primary inline-flex items-center gap-2">
                Ir a gestión de caja
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            }
          />
        </div>
      </div>
    )
  }

  // ── POS ─────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-canvas">
      {/* Selector de vista (solo móvil / tablet vertical) */}
      <div className="shrink-0 border-b border-line bg-card p-2 lg:hidden">
        <SegmentedControl
          label="Vista del punto de venta"
          value={mobileTab}
          onChange={setMobileTab}
          options={[
            { value: 'productos', label: 'Productos' },
            { value: 'carrito', label: 'Carrito', count: cart.totalItems },
          ]}
        />
      </div>

      <div className="flex min-h-0 flex-1">
        {/* ── Productos ─────────────────────────────────────── */}
        <div className={mobileTab === 'carrito' ? 'hidden min-w-0 flex-1 flex-col lg:flex' : 'flex min-w-0 flex-1 flex-col'}>
          <div className="shrink-0 border-b border-line bg-card p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
              <input
                ref={searchInputRef}
                type="search"
                aria-label="Buscar producto por nombre, código o marca"
                value={searchTerm}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                enterKeyHint="search"
                placeholder="Buscar producto, código o marca"
                className="input-field pl-9 pr-11"
                autoComplete="off"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('')
                    searchInputRef.current?.focus()
                  }}
                  aria-label="Limpiar búsqueda"
                  className="absolute right-1 top-1/2 flex h-[40px] w-[40px] -translate-y-1/2 items-center justify-center rounded-lg text-fg-subtle transition-colors hover:text-fg"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
            <p className="mt-1.5 hidden text-xs text-fg-subtle lg:block">Enter agrega el primer resultado. Si usas lector, escanea el código directamente.</p>
          </div>

          <div className="scroll-region min-h-0 flex-1 p-3">
            {productosLoading && productos.length === 0 ? (
              <div className="grid grid-cols-2 gap-2 xl:grid-cols-3 2xl:grid-cols-4" aria-busy="true">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-32 rounded-xl" />
                ))}
              </div>
            ) : productos.length === 0 ? (
              <EmptyState
                icon={PackageSearch}
                title="No se encontraron productos"
                description={debouncedSearch ? `Sin resultados para «${debouncedSearch}».` : 'Aún no hay productos activos.'}
              />
            ) : (
              <ul className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" aria-label="Productos">
                {productos.map((p) => (
                  <li key={p.id}>
                    <ProductCard producto={p} onClick={() => cart.addToCart(p)} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Resumen fijo del carrito (móvil): el total siempre a la vista, sin saltar de pestaña al agregar */}
          {cart.totalItems > 0 && (
            <div className="shrink-0 border-t border-line bg-card p-2 lg:hidden">
              <Button block size="lg" onClick={() => setMobileTab('carrito')} aria-label={`Ver carrito: ${cart.totalItems} ítems, total ${formatCurrency(cart.total)}`}>
                <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                Ver carrito · {cart.totalItems} · {formatCurrency(cart.total)}
              </Button>
            </div>
          )}
        </div>

        {/* ── Carrito ───────────────────────────────────────── */}
        <div className={mobileTab === 'productos' ? 'hidden w-[340px] shrink-0 border-l border-line lg:block' : 'block w-full shrink-0 lg:w-[340px] lg:border-l lg:border-line'}>
          <CartPanel
            carrito={cart.carrito}
            totalItems={cart.totalItems}
            subtotal={cart.subtotal}
            descuento={cart.descuento}
            descuentoClamp={cart.descuentoClamp}
            total={cart.total}
            sucursalId={user?.sucursal_id ?? ''}
            clienteId={clienteId}
            clienteNombre={clienteNombre}
            onQuantityChange={cart.changeQuantity}
            onPriceChange={cart.changePrice}
            onRemove={cart.remove}
            onDescuentoChange={cart.setDescuento}
            onClienteChange={(id, nombre) => {
              setClienteId(id)
              setClienteNombre(nombre)
            }}
            onVaciar={cart.empty}
            onCobrar={() => setShowPayment(true)}
          />
        </div>
      </div>

      {showPayment && (
        <PaymentModal
          total={cart.total}
          subtotal={cart.subtotal}
          descuento={cart.descuentoClamp}
          items={cart.carrito}
          clienteId={clienteId}
          clienteNombre={clienteNombre}
          onClose={() => setShowPayment(false)}
          onSuccess={(venta) => {
            setShowPayment(false)
            setItemsParaRecibo([...cart.carrito])
            setVentaCreada(venta)
            toast.success('Venta registrada exitosamente')
          }}
        />
      )}

      {ventaCreada && <ReceiptModal venta={ventaCreada} items={itemsParaRecibo} vendedorNombre={user?.nombre ?? ''} onNuevaVenta={clearAll} />}
    </div>
  )
}
