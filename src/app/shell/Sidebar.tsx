import { NavLink } from 'react-router-dom'
import { Droplets, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { cn } from '@/shared/utils/cn'
import { Tooltip, ThemeToggle } from '@/shared/ui'
import { formatRolUsuario } from '@/shared/utils/formatters'
import { PRIMARY_ACTIONS, visibleGroups, HOME } from './nav.config'
import type { NavItem } from './nav.config'
import type { UsuarioPerfil } from '@/features/auth/types'

interface SidebarProps {
  user: UsuarioPerfil | null
  expanded: boolean
  /** Por encima del contenido (tablet): sombra más marcada. */
  overlay: boolean
  isOnline: boolean
  onToggle: () => void
  onSignOut: () => void
}

function initialsOf(name: string | undefined): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function SidebarLink({ item, expanded }: { item: NavItem; expanded: boolean }) {
  const { to, label, icon: Icon, exact } = item
  return (
    <Tooltip label={label} disabled={expanded} className="flex w-full">
      <NavLink
        to={to}
        end={exact}
        className={({ isActive }) =>
          cn(
            'group relative flex min-h-[40px] items-center rounded-lg text-sm font-medium transition-colors [@media(max-height:820px)]:min-h-[32px]',
            expanded ? 'gap-3 px-3' : 'mx-auto w-[44px] justify-center',
            isActive ? 'bg-white/10 text-white' : 'text-sidebar-text hover:bg-white/5 hover:text-white',
          )
        }
      >
        {({ isActive }) => (
          <>
            {isActive && (
              <span aria-hidden="true" className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-accent-400" />
            )}
            <Icon
              className={cn('h-[18px] w-[18px] flex-shrink-0 transition-colors', isActive ? 'text-accent-300' : 'text-slate-400 group-hover:text-slate-200')}
              aria-hidden="true"
            />
            <span className={expanded ? 'truncate' : 'sr-only'}>{label}</span>
          </>
        )}
      </NavLink>
    </Tooltip>
  )
}

function ActionLink({ item, expanded, primary }: { item: NavItem; expanded: boolean; primary: boolean }) {
  const { to, label, icon: Icon } = item
  return (
    <Tooltip label={label} disabled={expanded} className={expanded ? 'flex w-full' : undefined}>
      <NavLink
        to={to}
        className={({ isActive }) =>
          cn(
            'flex items-center rounded-lg text-sm font-semibold transition-colors',
            expanded && 'w-full',
            expanded ? 'min-h-[40px] gap-2.5 px-3 [@media(max-height:820px)]:min-h-[34px]' : 'mx-auto h-[44px] w-[44px] justify-center',
            primary
              ? 'bg-accent-700 text-white hover:bg-accent-800'
              : 'border border-white/15 text-slate-100 hover:bg-white/10',
            isActive && !primary && 'bg-white/10',
          )
        }
      >
        <Icon className="h-[18px] w-[18px] flex-shrink-0" aria-hidden="true" />
        <span className={expanded ? 'truncate' : 'sr-only'}>{label}</span>
      </NavLink>
    </Tooltip>
  )
}

export function Sidebar({ user, expanded, overlay, isOnline, onToggle, onSignOut }: SidebarProps) {
  const groups = visibleGroups(user?.rol)
  const toggleLabel = expanded ? 'Contraer menú' : 'Expandir menú'
  const ToggleIcon = expanded ? PanelLeftClose : PanelLeftOpen

  return (
    <aside
      aria-label="Barra lateral"
      className={cn(
        'fixed inset-y-0 left-0 z-40 flex flex-col overflow-hidden border-r border-white/5 transition-[width,box-shadow] duration-200 ease-out',
        expanded ? 'w-64' : 'w-[72px]',
        overlay && expanded ? 'shadow-2xl' : 'shadow-sidebar',
      )}
      style={{ background: 'linear-gradient(180deg, #0f172a 0%, #111827 100%)' }}
    >
      {/* Marca */}
      <div className={cn('flex h-16 flex-shrink-0 items-center border-b border-white/5', expanded ? 'gap-3 px-4' : 'justify-center')}>
        <NavLink
          to={HOME.to}
          aria-label="Ir al inicio"
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-white"
          style={{ background: 'linear-gradient(135deg, #0ea5e9, #1F3864)' }}
        >
          <Droplets className="h-5 w-5" aria-hidden="true" />
        </NavLink>
        {expanded && (
          <>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-sm font-bold leading-tight text-white">Lubricentro</p>
              <p className="truncate text-xs font-medium text-accent-300">E&apos; Manuel · POS</p>
            </div>
            <Tooltip label={toggleLabel} side="bottom">
              <button
                type="button"
                onClick={onToggle}
                aria-label={toggleLabel}
                aria-expanded={expanded}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
              >
                <ToggleIcon className="h-[18px] w-[18px]" aria-hidden="true" />
              </button>
            </Tooltip>
          </>
        )}
      </div>

      <nav aria-label="Navegación principal" className="scroll-region flex-1 space-y-4 px-3 py-4 [@media(max-height:820px)]:space-y-2.5 [@media(max-height:820px)]:py-3">
        {/* Acciones frecuentes */}
        <div className={cn('space-y-2', !expanded && 'flex flex-col items-center')}>
          {PRIMARY_ACTIONS.map((a, i) => (
            <ActionLink key={a.to} item={a} expanded={expanded} primary={i === 0} />
          ))}
        </div>

        <div className="space-y-0.5">
          <SidebarLink item={HOME} expanded={expanded} />
        </div>

        {groups.map((group) => (
          <div key={group.label}>
            {expanded ? (
              <>
                {/* En pantallas bajas (laptops de 768px) las etiquetas se cambian por un separador para ganar espacio */}
                <p className="px-3 pb-1.5 text-xs font-semibold uppercase tracking-wider text-sidebar-text [@media(max-height:820px)]:hidden">{group.label}</p>
                <div aria-hidden="true" className="mx-3 mb-1.5 hidden h-px bg-white/10 [@media(max-height:820px)]:block" />
              </>
            ) : (
              <div aria-hidden="true" className="mx-auto mb-2 h-px w-6 bg-white/10" />
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <SidebarLink item={item} expanded={expanded} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Pie: tema, colapsar, usuario */}
      <div className="flex-shrink-0 border-t border-white/5 p-3">
        <div className={cn('mb-2 flex items-center [@media(max-height:820px)]:mb-0', expanded ? 'justify-between' : 'flex-col gap-1')}>
          {/* En pantallas bajas el cambio de tema vive solo en la barra superior */}
          <ThemeToggle showLabel={expanded} className="text-sidebar-text hover:bg-white/10 hover:text-white [@media(max-height:820px)]:hidden" />
          {!expanded && (
            <Tooltip label={toggleLabel}>
              <button
                type="button"
                onClick={onToggle}
                aria-label={toggleLabel}
                aria-expanded={expanded}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-sidebar-text transition-colors hover:bg-white/10 hover:text-white"
              >
                <ToggleIcon className="h-[18px] w-[18px]" aria-hidden="true" />
              </button>
            </Tooltip>
          )}
        </div>

        <div className={cn('flex items-center rounded-lg', expanded ? 'gap-3 px-2 py-2' : 'flex-col gap-2 py-1')}>
          <Tooltip label={`${user?.nombre ?? ''} · ${formatRolUsuario(user?.rol ?? '')}`} disabled={expanded}>
            <div
              className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #0ea5e9, #1F3864)' }}
              role="img"
              aria-label={user?.nombre ?? 'Usuario'}
            >
              {initialsOf(user?.nombre)}
              <span
                className={cn('absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-slate-900', isOnline ? 'bg-emerald-400' : 'bg-amber-400')}
                title={isOnline ? 'En línea' : 'Sin conexión'}
              />
            </div>
          </Tooltip>
          {expanded && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{user?.nombre}</p>
              <p className="truncate text-xs text-sidebar-text">{formatRolUsuario(user?.rol ?? '')}</p>
            </div>
          )}
          <Tooltip label="Cerrar sesión">
            <button
              type="button"
              onClick={onSignOut}
              aria-label="Cerrar sesión"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-sidebar-text transition-colors hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
          </Tooltip>
        </div>
      </div>
    </aside>
  )
}
