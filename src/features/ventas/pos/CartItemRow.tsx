import { useState } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'
import { Minus, Plus, X } from 'lucide-react'
import { cn } from '@/shared/utils/cn'
import { formatCurrency } from '@/shared/utils/formatters'
import type { ItemCarrito } from './constants'

interface CartItemRowProps {
  item: ItemCarrito
  onQuantityChange: (productoId: string, qty: number) => void
  onPriceChange: (productoId: string, price: number) => void
  onRemove: (productoId: string) => void
}

const stepBtn =
  'flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-line text-fg-muted transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 [@media(pointer:coarse)]:h-[44px] [@media(pointer:coarse)]:w-[44px]'

export function CartItemRow({ item, onQuantityChange, onPriceChange, onRemove }: CartItemRowProps) {
  const [editingPrice, setEditingPrice] = useState(false)
  const [priceInput, setPriceInput] = useState(String(item.precio_unitario))
  const modificado = item.precio_unitario !== item.precio_lista

  function commitPrice() {
    const val = parseFloat(priceInput)
    if (!isNaN(val) && val > 0) onPriceChange(item.producto_id, val)
    else setPriceInput(String(item.precio_unitario))
    setEditingPrice(false)
  }

  return (
    <li className="flex flex-col gap-2 border-b border-line py-3 last:border-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight text-fg">{item.nombre}</p>
          <p className="font-mono text-xs text-fg-subtle">{item.codigo_interno}</p>
        </div>
        <button
          type="button"
          onClick={() => onRemove(item.producto_id)}
          aria-label={`Quitar ${item.nombre}`}
          className="-mr-1 -mt-1 flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg text-fg-subtle transition-colors hover:text-red-600 [@media(pointer:coarse)]:h-[44px] [@media(pointer:coarse)]:w-[44px]"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1" role="group" aria-label={`Cantidad de ${item.nombre}`}>
          <button
            type="button"
            onClick={() => onQuantityChange(item.producto_id, item.cantidad - 1)}
            disabled={item.cantidad <= 1}
            aria-label="Disminuir cantidad"
            className={stepBtn}
          >
            <Minus className="h-4 w-4" aria-hidden="true" />
          </button>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={item.stock_disponible}
            value={item.cantidad}
            aria-label={`Cantidad de ${item.nombre}`}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              const val = parseInt(e.target.value, 10)
              if (!isNaN(val) && val >= 1) onQuantityChange(item.producto_id, val)
            }}
            className="h-[34px] w-12 rounded-lg border border-line bg-card text-center text-sm font-semibold text-fg focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500 [@media(pointer:coarse)]:h-[44px]"
          />
          <button
            type="button"
            onClick={() => onQuantityChange(item.producto_id, item.cantidad + 1)}
            disabled={item.cantidad >= item.stock_disponible}
            aria-label="Aumentar cantidad"
            className={stepBtn}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="text-right">
          {editingPrice ? (
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={0.01}
              value={priceInput}
              aria-label={`Precio unitario de ${item.nombre}`}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setPriceInput(e.target.value)}
              onBlur={commitPrice}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                if (e.key === 'Enter') commitPrice()
                if (e.key === 'Escape') {
                  setPriceInput(String(item.precio_unitario))
                  setEditingPrice(false)
                }
              }}
              className="w-24 rounded-lg border border-accent-500 bg-card px-1.5 py-0.5 text-right text-sm text-fg focus:outline-none focus:ring-1 focus:ring-accent-500"
              autoFocus
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setPriceInput(String(item.precio_unitario))
                setEditingPrice(true)
              }}
              title="Editar precio unitario"
              aria-label={`Precio unitario ${formatCurrency(item.precio_unitario)}. Editar`}
              className={cn(
                'inline-flex min-h-touch items-center text-sm underline-offset-2 transition-colors hover:text-primary-700 hover:underline md:min-h-0',
                modificado ? 'font-semibold text-orange-700 dark:text-orange-300' : 'text-fg-muted',
              )}
            >
              {formatCurrency(item.precio_unitario)}
            </button>
          )}
          <p className="text-sm font-bold text-primary-700">{formatCurrency(item.subtotal)}</p>
        </div>
      </div>
    </li>
  )
}
