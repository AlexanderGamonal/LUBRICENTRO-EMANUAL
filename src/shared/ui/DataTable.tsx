import { Fragment } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/shared/utils/cn'
import { Skeleton } from './Skeleton'

/** Cómo se muestra la columna en las tarjetas de móvil. */
export type MobileRole = 'title' | 'subtitle' | 'field' | 'actions' | 'hidden'

export interface Column<T> {
  key: string
  header: string
  cell: (row: T) => ReactNode
  /** Papel en la tarjeta móvil. Por defecto `field` (etiqueta + valor). */
  mobile?: MobileRole
  align?: 'left' | 'right' | 'center'
  /** Oculta la columna en tablets (menos de `lg`) para que la tabla no se desborde. */
  hideBelowLg?: boolean
  /** Clases extra de la celda en la tabla. */
  className?: string
  /** El encabezado queda solo para lectores de pantalla (p. ej. columna de acciones). */
  srOnlyHeader?: boolean
}

interface DataTableProps<T> {
  /** Nombre accesible de la tabla (se lee al enfocar la región con scroll). */
  caption: string
  columns: Column<T>[]
  rows: T[] | undefined
  rowKey: (row: T) => string
  loading?: boolean
  /** Contenido cuando no hay filas (usa <EmptyState>). */
  empty?: ReactNode
  /** Clases extra por fila (resaltar, atenuar inactivos…). */
  rowClassName?: (row: T) => string | undefined
  skeletonRows?: number
  className?: string
  /**
   * Filas expandibles: el estado vive en la página (un botón en la celda decide qué se expande).
   * En tabla el detalle ocupa una fila extra; en móvil, un panel dentro de la tarjeta.
   */
  expand?: {
    isExpanded: (row: T) => boolean
    render: (row: T) => ReactNode
  }
}

const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' } as const

/**
 * Tabla responsiva: tabla real desde `md`, tarjetas en móvil.
 * La región con scroll es enfocable (flechas del teclado) y tiene nombre accesible.
 */
export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  loading,
  empty,
  rowClassName,
  skeletonRows = 4,
  className,
  expand,
}: DataTableProps<T>) {
  const title = columns.find((c) => c.mobile === 'title')
  const subtitle = columns.find((c) => c.mobile === 'subtitle')
  const actions = columns.find((c) => c.mobile === 'actions')
  const fields = columns.filter((c) => !c.mobile || c.mobile === 'field')
  const isEmpty = !loading && (!rows || rows.length === 0)

  if (isEmpty && empty) {
    return <div className={cn('rounded-xl border border-line bg-card', className)}>{empty}</div>
  }

  return (
    <div className={className}>
      {/* ── Tabla (md+) ─────────────────────────────── */}
      <div
        role="region"
        aria-label={caption}
        tabIndex={0}
        className="scroll-region hidden rounded-xl border border-line bg-card shadow-card md:block"
      >
        <table className="w-full text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-line bg-muted">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn(
                    'whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-fg-muted',
                    ALIGN[c.align ?? 'left'],
                    c.hideBelowLg && 'hidden lg:table-cell',
                  )}
                >
                  <span className={c.srOnlyHeader ? 'sr-only' : undefined}>{c.header}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: skeletonRows }).map((_, i) => (
                <tr key={i} className="border-b border-line last:border-0">
                  {columns.map((c) => (
                    <td key={c.key} className={cn('px-4 py-3', c.hideBelowLg && 'hidden lg:table-cell')}>
                      <Skeleton className="h-4 w-full max-w-[8rem]" />
                    </td>
                  ))}
                </tr>
              ))}
            {rows?.map((row) => (
              <Fragment key={rowKey(row)}>
                <tr className={cn('border-b border-line transition-colors last:border-0 hover:bg-muted', rowClassName?.(row))}>
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn('px-4 py-3 align-middle text-fg-muted', ALIGN[c.align ?? 'left'], c.hideBelowLg && 'hidden lg:table-cell', c.className)}
                    >
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
                {expand?.isExpanded(row) && (
                  <tr className="border-b border-line bg-muted/60">
                    <td colSpan={columns.length} className="px-6 py-3">
                      {expand.render(row)}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Tarjetas (móvil) ────────────────────────── */}
      <ul className="space-y-2.5 md:hidden" aria-label={caption}>
        {loading &&
          Array.from({ length: skeletonRows }).map((_, i) => (
            <li key={i} className="space-y-2 rounded-xl border border-line bg-card p-4">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-3 w-full" />
            </li>
          ))}
        {isEmpty && <li className="rounded-xl border border-line bg-card px-4 py-8 text-center text-sm text-fg-muted">Sin resultados</li>}
        {rows?.map((row) => (
          <li key={rowKey(row)} className={cn('rounded-xl border border-line bg-card p-4 shadow-card', rowClassName?.(row))}>
            {(title || subtitle) && (
              <div className="mb-2.5 min-w-0">
                {title && <div className="font-semibold text-fg">{title.cell(row)}</div>}
                {subtitle && <div className="mt-0.5 text-sm text-fg-muted">{subtitle.cell(row)}</div>}
              </div>
            )}
            {fields.length > 0 && (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                {fields.map((c) => (
                  <div key={c.key} className="min-w-0">
                    <dt className="text-xs font-medium text-fg-subtle">{c.header}</dt>
                    <dd className="mt-0.5 break-words text-fg">{c.cell(row)}</dd>
                  </div>
                ))}
              </dl>
            )}
            {actions && <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">{actions.cell(row)}</div>}
            {expand?.isExpanded(row) && <div className="mt-3 border-t border-line pt-3">{expand.render(row)}</div>}
          </li>
        ))}
      </ul>
    </div>
  )
}
