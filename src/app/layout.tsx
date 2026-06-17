import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus'
import { formatRolUsuario } from '@/shared/utils/formatters'
import { useState, useEffect } from 'react'

const navItems = [
  { to: '/', label: 'Dashboard', icon: HomeIcon, exact: true },
  { to: '/productos', label: 'Productos', icon: PackageIcon },
  { to: '/inventario', label: 'Inventario', icon: ChartIcon },
  { to: '/busqueda', label: 'Búsqueda', icon: SearchIcon },
  { to: '/importacion', label: 'Importar', icon: UploadIcon },
]

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/productos': 'Productos',
  '/inventario': 'Inventario',
  '/busqueda': 'Búsqueda Rápida',
  '/importacion': 'Importación',
}

function usePageTitle() {
  const location = useLocation()
  const path = location.pathname
  if (path.startsWith('/productos/') && path.includes('/editar')) return 'Editar Producto'
  if (path === '/productos/nuevo') return 'Nuevo Producto'
  if (path.startsWith('/inventario/ajuste/')) return 'Ajuste de Stock'
  return pageTitles[path] ?? 'Lubricentro E\' Manuel'
}

function useClock() {
  const [time, setTime] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return time.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })
}

export function AppLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { isOnline } = useOnlineStatus()
  const pageTitle = usePageTitle()
  const time = useClock()

  const initials = user?.nombre
    ? user.nombre.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f1f5f9' }}>
      {/* Offline banner */}
      {!isOnline && (
        <div className="bg-amber-400 text-amber-900 text-xs font-semibold text-center py-2 px-4 z-50 flex items-center justify-center gap-2">
          <span>⚠️</span>
          Sin conexión a internet. Algunas funciones no están disponibles.
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar (Desktop) ─────────────────── */}
        <aside
          className="hidden md:flex flex-col w-60 flex-shrink-0 animate-slide-in-left"
          style={{
            background: 'linear-gradient(180deg, #0f172a 0%, #111827 100%)',
            boxShadow: '4px 0 24px rgba(0,0,0,0.25)',
          }}
        >
          {/* Brand */}
          <div className="px-5 py-5 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
                style={{ background: 'linear-gradient(135deg, #0ea5e9, #1F3864)' }}
              >
                🛢️
              </div>
              <div>
                <h1 className="font-bold text-sm text-white leading-tight">
                  Lubricentro
                </h1>
                <p className="text-[11px] font-medium" style={{ color: '#0ea5e9' }}>
                  E' Manuel · POS
                </p>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 py-4 overflow-y-auto space-y-0.5 px-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest px-3 py-2" style={{ color: '#475569' }}>
              Menú Principal
            </p>
            {navItems.map(({ to, label, icon: Icon, exact }) => (
              <NavLink
                key={to}
                to={to}
                end={exact}
                className={({ isActive }) =>
                  `relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${
                    isActive
                      ? 'text-white'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`
                }
                style={({ isActive }) => isActive ? {
                  background: 'linear-gradient(90deg, rgba(14,165,233,0.18) 0%, rgba(14,165,233,0.06) 100%)',
                } : {}}
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full"
                        style={{ background: '#0ea5e9' }}
                      />
                    )}
                    <Icon className={`w-4 h-4 flex-shrink-0 transition-colors ${isActive ? 'text-accent-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                    {label}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* User */}
          <div className="px-3 py-4 border-t border-white/5">
            <div className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-white/5 transition-colors cursor-default">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #0ea5e9, #1F3864)' }}
              >
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">{user?.nombre}</p>
                <p className="text-[11px] text-slate-400">{formatRolUsuario(user?.rol ?? '')}</p>
              </div>
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isOnline ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            </div>
            <button
              onClick={handleSignOut}
              className="w-full mt-1 flex items-center gap-2 px-2 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-150"
            >
              <LogOutIcon className="w-3.5 h-3.5" />
              Cerrar sesión
            </button>
          </div>
        </aside>

        {/* ── Main Content ──────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Topbar (Desktop) */}
          <header className="hidden md:flex items-center justify-between px-6 py-3.5 bg-white border-b border-gray-200/80 flex-shrink-0"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
          >
            <div>
              <h2 className="text-base font-bold text-gray-800">{pageTitle}</h2>
              <p className="text-xs text-gray-400">Sistema de Punto de Venta</p>
            </div>
            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ${
                isOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                {isOnline ? 'En línea' : 'Sin conexión'}
              </div>
              <div className="text-xs font-semibold text-gray-600 tabular-nums bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
                🕐 {time}
              </div>
            </div>
          </header>

          {/* Topbar (Mobile) */}
          <header className="md:hidden bg-gradient-to-r from-slate-900 to-primary-700 text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="text-lg">🛢️</span>
              <div>
                <h1 className="font-bold text-sm leading-tight">Lubricentro E' Manuel</h1>
                <p className="text-[10px] text-blue-300">Sistema POS</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span className="text-xs text-blue-200">{user?.nombre?.split(' ')[0]}</span>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto pb-20 md:pb-0 animate-fade-in">
            <Outlet />
          </main>
        </div>
      </div>

      {/* ── Bottom Nav (Mobile) ───────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200"
        style={{
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <div className="grid grid-cols-5">
          {navItems.map(({ to, label, icon: Icon, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                `flex flex-col items-center py-2.5 px-1 text-[10px] font-medium transition-colors ${
                  isActive ? 'text-accent-600' : 'text-gray-400'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`p-1.5 rounded-lg transition-colors ${isActive ? 'bg-accent-50' : ''}`}>
                    <Icon className={`w-5 h-5 ${isActive ? 'text-accent-600' : 'text-gray-400'}`} />
                  </div>
                  <span className="truncate mt-0.5">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

/* ── Icons ──────────────────────────────────── */
function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
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

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  )
}

function LogOutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  )
}

