import { Link } from 'react-router-dom'
import { ChevronRight, Droplets, Search } from 'lucide-react'
import { cn } from '@/shared/utils/cn'
import { ThemeToggle } from '@/shared/ui'
import { Clock } from './Clock'
import type { PageMeta } from './nav.config'
import { APP_NAME } from './nav.config'

interface TopbarProps {
  meta: PageMeta
  isHome: boolean
  isOnline: boolean
  firstName?: string
  onOpenSearch: () => void
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

function OnlinePill({ isOnline }: { isOnline: boolean }) {
  return (
    <div
      role="status"
      className={cn(
        'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium',
        isOnline ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', isOnline ? 'bg-emerald-500' : 'bg-amber-500')} aria-hidden="true" />
      {isOnline ? 'En línea' : 'Sin conexión'}
    </div>
  )
}

/** Barra superior de escritorio / tablet. */
export function Topbar({ meta, isOnline, onOpenSearch }: TopbarProps) {
  return (
    <header className="hidden h-16 flex-shrink-0 items-center justify-between gap-4 border-b border-line bg-card px-6 md:flex">
      <div className="min-w-0">
        {meta.crumbs.length > 0 && (
          <nav aria-label="Ruta de navegación" className="mb-0.5 flex items-center gap-1 text-xs text-fg-subtle">
            {meta.crumbs.map((c, i) => (
              <span key={c.label} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3" aria-hidden="true" />}
                {c.to ? (
                  <Link to={c.to} className="rounded transition-colors hover:text-fg">
                    {c.label}
                  </Link>
                ) : (
                  <span aria-current="page" className="text-fg-muted">
                    {c.label}
                  </span>
                )}
              </span>
            ))}
          </nav>
        )}
        <p className="truncate font-display text-base font-bold text-fg">{meta.title}</p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Abrir buscador global"
          aria-keyshortcuts="Control+K Meta+K"
          className="flex w-48 items-center gap-2 rounded-lg border border-line bg-muted px-3 py-2 text-sm text-fg-subtle transition-colors hover:border-accent-400 hover:text-fg-muted lg:w-72"
        >
          <Search className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <span className="flex-1 truncate text-left">Buscar o ir a…</span>
          <kbd className="hidden rounded border border-line bg-card px-1.5 py-0.5 font-sans text-xs font-medium text-fg-subtle lg:inline">
            {isMac ? '⌘' : 'Ctrl'} K
          </kbd>
        </button>
        <ThemeToggle className="border border-line text-fg-muted hover:bg-muted" />
        <OnlinePill isOnline={isOnline} />
        <div className="hidden xl:block">
          <Clock />
        </div>
      </div>
    </header>
  )
}

/** Barra superior móvil: título de la página y búsqueda. */
export function MobileTopbar({ meta, isHome, isOnline, firstName, onOpenSearch }: TopbarProps) {
  return (
    <header className="flex min-h-14 flex-shrink-0 items-center gap-3 bg-gradient-to-r from-slate-900 to-primary-700 px-4 pt-safe-t text-white md:hidden">
      <div className="flex min-w-0 flex-1 items-center gap-2.5 py-2">
        <Droplets className="h-5 w-5 flex-shrink-0 text-accent-300" aria-hidden="true" />
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-bold leading-tight">{isHome ? APP_NAME : meta.title}</p>
          {isHome && firstName && <p className="truncate text-xs text-blue-200">Hola, {firstName}</p>}
        </div>
      </div>
      <span
        role="status"
        title={isOnline ? 'En línea' : 'Sin conexión'}
        aria-label={isOnline ? 'En línea' : 'Sin conexión'}
        className={cn('h-2.5 w-2.5 flex-shrink-0 rounded-full', isOnline ? 'bg-emerald-400' : 'bg-amber-400')}
      />
      <button
        type="button"
        onClick={onOpenSearch}
        aria-label="Abrir buscador"
        className="flex h-[44px] w-[44px] flex-shrink-0 items-center justify-center rounded-lg text-white transition-colors hover:bg-white/10"
      >
        <Search className="h-5 w-5" aria-hidden="true" />
      </button>
    </header>
  )
}
