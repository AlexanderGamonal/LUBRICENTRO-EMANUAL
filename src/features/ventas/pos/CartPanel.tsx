import type { ChangeEvent } from 'react'
import { ShoppingCart, Trash2 } from 'lucide-react'
import { Button, EmptyState, Field } from '@/shared/ui'
import { ClienteCombobox } from '@/features/clientes/ClienteCombobox'
import { formatCurrency } from '@/shared/utils/formatters'
import { CartItemRow } from './CartItemRow'
import type { ItemCarrito } from './constants'

interface CartPanelProps {
  carrito: ItemCarrito[]
  totalItems: number
  subtotal: number
  descuento: number
  descuentoClamp: number
  total: number
  sucursalId: string
  clienteId: string | null
  clienteNombre: string | null
  onQuantityChange: (productoId: string, qty: number) => void
  onPriceChange: (productoId: string, price: number) => void
  onRemove: (productoId: string) => void
  onDescuentoChange: (value: number) => void
  onClienteChange: (id: string | null, nombre: string | null) => void
  onVaciar: () => void
  onCobrar: () => void
}

/** Carrito: lista con scroll + (cliente y descuento) y, siempre visibles abajo, totales y COBRAR. */
export function CartPanel(props: CartPanelProps) {
  const { carrito, totalItems, subtotal, descuento, descuentoClamp, total } = props

  return (
    <section aria-label="Carrito de venta" className="flex h-full min-h-0 flex-col bg-card">
      <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
        <h2 className="flex items-center gap-2 text-base font-bold text-fg">
          Carrito
          {totalItems > 0 && (
            <span className="rounded-full bg-primary-700/10 px-2 py-0.5 text-xs font-semibold text-primary-700">
              {totalItems} {totalItems === 1 ? 'ítem' : 'ítems'}
            </span>
          )}
        </h2>
        {carrito.length > 0 && (
          <button
            type="button"
            onClick={props.onVaciar}
            className="inline-flex min-h-touch items-center gap-1 rounded-lg px-2 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 md:min-h-0 md:py-1"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Vaciar
          </button>
        )}
      </div>

      <div className="scroll-region min-h-0 flex-1 px-4">
        {carrito.length === 0 ? (
          <EmptyState icon={ShoppingCart} title="El carrito está vacío" description="Busca un producto o escanea su código para agregarlo." className="h-full py-10" />
        ) : (
          <>
            <ul aria-label="Productos en el carrito">
              {carrito.map((item) => (
                <CartItemRow key={item.producto_id} item={item} onQuantityChange={props.onQuantityChange} onPriceChange={props.onPriceChange} onRemove={props.onRemove} />
              ))}
            </ul>

            <div className="space-y-4 border-t border-line py-4">
              <ClienteCombobox
                label="Cliente (opcional)"
                sucursalId={props.sucursalId}
                value={props.clienteId ?? ''}
                selectedNombre={props.clienteNombre ?? ''}
                onChange={(id, nombre) => props.onClienteChange(id || null, nombre || null)}
              />
              <Field label="Descuento (S/)">
                {(p) => (
                  <input
                    {...p}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={subtotal}
                    step={0.5}
                    value={descuento || ''}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      const val = parseFloat(e.target.value) || 0
                      props.onDescuentoChange(Math.max(0, Math.min(val, subtotal)))
                    }}
                    placeholder="0.00"
                    className="input-field"
                  />
                )}
              </Field>
            </div>
          </>
        )}
      </div>

      <div className="shrink-0 space-y-3 border-t border-line bg-card p-4">
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between text-fg-muted">
            <dt>Subtotal</dt>
            <dd>{formatCurrency(subtotal)}</dd>
          </div>
          {descuentoClamp > 0 && (
            <div className="flex justify-between text-orange-700 dark:text-orange-300">
              <dt>Descuento</dt>
              <dd>−{formatCurrency(descuentoClamp)}</dd>
            </div>
          )}
          <div className="flex items-baseline justify-between border-t border-line pt-2 text-primary-700">
            <dt className="text-sm font-bold">TOTAL</dt>
            <dd className="font-display text-2xl font-bold tabular-nums">{formatCurrency(total)}</dd>
          </div>
        </dl>
        <Button size="lg" block onClick={props.onCobrar} disabled={carrito.length === 0}>
          {carrito.length === 0 ? 'Cobrar' : `Cobrar ${formatCurrency(total)}`}
        </Button>
      </div>
    </section>
  )
}
