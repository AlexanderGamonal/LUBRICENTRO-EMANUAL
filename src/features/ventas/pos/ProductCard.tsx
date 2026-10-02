import { cn } from '@/shared/utils/cn'
import { formatCurrency } from '@/shared/utils/formatters'
import { STOCK_BADGE } from './constants'
import type { ProductoDetalle } from './constants'

interface ProductCardProps {
  producto: ProductoDetalle
  onClick: () => void
}

export function ProductCard({ producto, onClick }: ProductCardProps) {
  const stockCfg = STOCK_BADGE[producto.stock_estado]
  const agotado = producto.stock_estado === 'agotado'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={agotado}
      aria-label={`Agregar ${producto.nombre}, ${formatCurrency(producto.precio_venta)}, ${stockCfg.label}${agotado ? '' : `, ${producto.stock_actual} disponibles`}`}
      className={cn(
        'flex h-full w-full flex-col rounded-xl border-2 bg-card p-3 text-left transition-all',
        agotado
          ? 'cursor-not-allowed border-line bg-muted'
          : 'cursor-pointer border-line hover:border-accent-500 hover:shadow-md active:scale-[0.97]',
      )}
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <p className={cn('line-clamp-2 flex-1 text-sm font-semibold leading-tight', agotado ? 'text-fg-subtle' : 'text-fg')}>{producto.nombre}</p>
        <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-xs font-medium', stockCfg.badgeClass)}>{producto.stock_actual}</span>
      </div>
      {producto.marca && <p className="mb-0.5 truncate text-xs text-fg-muted">{producto.marca}</p>}
      <p className="mb-2 font-mono text-xs text-fg-subtle">{producto.codigo_interno}</p>
      <div className="mt-auto">
        <p className={cn('text-base font-bold', agotado ? 'text-fg-subtle' : 'text-primary-700')}>{formatCurrency(producto.precio_venta)}</p>
        <p className={cn('mt-0.5 text-xs', stockCfg.textClass)}>{stockCfg.label}</p>
      </div>
    </button>
  )
}
