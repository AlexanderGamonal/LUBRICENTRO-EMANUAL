import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Ellipsis, LogOut } from 'lucide-react'
import { cn } from '@/shared/utils/cn'
import { Modal, ThemeToggle } from '@/shared/ui'
import { formatRolUsuario } from '@/shared/utils/formatters'
import { MOBILE_TABS, PRIMARY_ACTIONS, visibleGroups } from './nav.config'
import type { UsuarioPerfil } from '@/features/auth/types'
import { useMediaQuery } from './useSidebar'

interface MobileNavProps {
  user: UsuarioPerfil | null
  onSignOut: () => void
}

/** Barra inferior (4 accesos + "Más") y hoja con el menú completo. Solo en móvil. */
export function MobileNav({ user, onSignOut }: MobileNavProps) {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const groups = visibleGroups(user?.rol)

  useEffect(() => setOpen(false), [pathname, isDesktop])

  const tabClass = (active: boolean) =>
    cn(
      'flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-1 text-xs font-medium transition-colors',
      active ? 'text-primary-700 dark:text-accent-400' : 'text-fg-muted hover:text-fg',
    )

  return (
    <>
      <nav
        aria-label="Navegación inferior"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 pb-safe-b backdrop-blur md:hidden"
      >
        <div className="grid grid-cols-5">
          {MOBILE_TABS.map(({ to, label, icon: Icon, exact }) => (
            <NavLink key={to} to={to} end={exact} className={({ isActive }) => tabClass(isActive)}>
              {({ isActive }) => (
                <>
                  <span className={cn('flex h-7 w-12 items-center justify-center rounded-full transition-colors', isActive && 'bg-primary-700/10 dark:bg-accent-400/15')}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
          <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open} className={tabClass(open)}>
            <span className={cn('flex h-7 w-12 items-center justify-center rounded-full transition-colors', open && 'bg-primary-700/10 dark:bg-accent-400/15')}>
              <Ellipsis className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>Más</span>
          </button>
        </div>
      </nav>

      <Modal open={open} onOpenChange={setOpen} title="Menú" hideTitle size="md">
        <div className="-mx-1 space-y-5">
          <div className="flex items-center gap-3 px-1 pr-11">
            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #0ea5e9, #1F3864)' }}
              aria-hidden="true"
            >
              {user?.nombre
                ?.split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-fg">{user?.nombre}</p>
              <p className="text-xs text-fg-muted">{formatRolUsuario(user?.rol ?? '')}</p>
            </div>
            <ThemeToggle className="border border-line text-fg-muted hover:bg-muted" />
          </div>

          <div className="grid grid-cols-2 gap-2 px-1">
            {PRIMARY_ACTIONS.map(({ to, label, icon: Icon }, i) => (
              <NavLink
                key={to}
                to={to}
                className={cn(
                  'flex min-h-[48px] items-center justify-center gap-2 rounded-xl text-sm font-semibold',
                  i === 0 ? 'bg-accent-700 text-white' : 'border border-line bg-muted text-fg',
                )}
              >
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </div>

          {groups.map((group) => (
            <section key={group.label} className="px-1">
              <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-fg-subtle">{group.label}</h2>
              <ul className="grid grid-cols-2 gap-1.5">
                {group.items.map(({ to, label, icon: Icon, exact }) => (
                  <li key={to}>
                    <NavLink
                      to={to}
                      end={exact}
                      className={({ isActive }) =>
                        cn(
                          'flex min-h-[48px] items-center gap-2.5 rounded-xl px-3 text-sm font-medium transition-colors',
                          isActive ? 'bg-primary-700/10 text-primary-700 dark:bg-accent-400/15 dark:text-accent-300' : 'bg-muted text-fg hover:bg-line/50',
                        )
                      }
                    >
                      <Icon className="h-[18px] w-[18px] flex-shrink-0" aria-hidden="true" />
                      <span className="truncate">{label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <button
            type="button"
            onClick={onSignOut}
            className="mx-1 flex min-h-[48px] w-[calc(100%-0.5rem)] items-center justify-center gap-2 rounded-xl border border-line text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Cerrar sesión
          </button>
        </div>
      </Modal>
    </>
  )
}
