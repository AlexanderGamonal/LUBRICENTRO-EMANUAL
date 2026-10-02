import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { WifiOff } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus'
import { cn } from '@/shared/utils/cn'
import { Sidebar } from './shell/Sidebar'
import { MobileTopbar, Topbar } from './shell/Topbar'
import { MobileNav } from './shell/MobileNav'
import { CommandPalette } from './shell/CommandPalette'
import { APP_NAME, getPageMeta } from './shell/nav.config'
import { useSidebar } from './shell/useSidebar'

export function AppLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { isOnline } = useOnlineStatus()
  const sidebar = useSidebar()
  const [searchOpen, setSearchOpen] = useState(false)
  const mainRef = useRef<HTMLElement>(null)
  const meta = getPageMeta(pathname)

  // Título de la pestaña según la pantalla
  useEffect(() => {
    document.title = pathname === '/' ? APP_NAME : `${meta.title} · ${APP_NAME}`
  }, [pathname, meta.title])

  // Cada pantalla nueva empieza arriba
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
  }, [pathname])

  // Atajo global: Ctrl/⌘ + K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((o) => !o)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  const overlay = !sidebar.isWide && sidebar.expanded

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-canvas">
      <a href="#contenido" className="skip-link">
        Saltar al contenido
      </a>

      <div className="flex min-h-0 flex-1">
        {/* ── Menú lateral (escritorio y tablet) ────────────────── */}
        <div className={cn('hidden w-[72px] flex-shrink-0 transition-[width] duration-200 ease-out md:block', sidebar.isWide && sidebar.expanded && 'w-64')}>
          <Sidebar
            user={user}
            expanded={sidebar.expanded}
            overlay={overlay}
            isOnline={isOnline}
            onToggle={sidebar.toggle}
            onSignOut={handleSignOut}
          />
        </div>
        {overlay && <div aria-hidden="true" className="fixed inset-0 z-30 hidden animate-overlay-in bg-black/40 md:block" onClick={sidebar.close} />}

        {/* ── Contenido ─────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-1 flex-col">
          {!isOnline && (
            <div role="status" className="flex flex-shrink-0 items-center justify-center gap-2 bg-amber-400 px-4 py-2 text-xs font-semibold text-amber-950">
              <WifiOff className="h-4 w-4" aria-hidden="true" />
              Sin conexión a internet. Algunas funciones no están disponibles.
            </div>
          )}

          <Topbar meta={meta} isHome={pathname === '/'} isOnline={isOnline} onOpenSearch={() => setSearchOpen(true)} />
          <MobileTopbar
            meta={meta}
            isHome={pathname === '/'}
            isOnline={isOnline}
            firstName={user?.nombre?.split(' ')[0]}
            onOpenSearch={() => setSearchOpen(true)}
          />

          <main
            id="contenido"
            ref={mainRef}
            tabIndex={-1}
            className="min-h-0 flex-1 animate-fade-in overflow-y-auto pb-[calc(4.5rem+env(safe-area-inset-bottom))] focus:outline-none md:pb-0"
          >
            <Outlet />
          </main>
        </div>
      </div>

      <MobileNav user={user} onSignOut={handleSignOut} />
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  )
}
