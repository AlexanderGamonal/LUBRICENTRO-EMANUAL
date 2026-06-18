import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus'
import { formatRolUsuario } from '@/shared/utils/formatters'
import { useState, useEffect } from 'react'

const navSections = [
  {
    label: 'Ventas',
    items: [
      { to: '/caja', label: 'Caja', icon: CajaIcon },
      { to: '/ventas/nueva', label: 'Nueva Venta', icon: PosIcon },
      { to: '/ventas', label: 'Historial', icon: ReceiptIcon },
      { to: '/clientes', label: 'Clientes', icon: UsersIcon },
      { to: '/creditos', label: 'Créditos', icon: CreditIcon },
    ],
  },
  {
    label: 'Servicios',
    items: [
      { to: '/servicios/nuevo', label: 'Nueva Atención', icon: WrenchIcon },
      { to: '/servicios', label: 'Historial', icon: ClipboardIcon },
      { to: '/vehiculos', label: 'Vehículos', icon: CarIcon },
    ],
  },
  {
    label: 'Inventario',
    items: [
      { to: '/', label: 'Dashboard', icon: HomeIcon, exact: true },
      { to: '/productos', label: 'Productos', icon: PackageIcon },
      { to: '/inventario', label: 'Inventario', icon: ChartIcon },
      { to: '/busqueda', label: 'Búsqueda', icon: SearchIcon },
      { to: '/importacion', label: 'Importar', icon: UploadIcon },
    ],
  },
]

// 4 fixed items for mobile bottom bar
const mobileNavItems = [
  { to: '/', label: 'Inicio', icon: HomeIcon, exact: true },
  { to: '/ventas/nueva', label: 'Vender', icon: PosIcon },
  { to: '/caja', label: 'Caja', icon: CajaIcon },
  { to: '/busqueda', label: 'Buscar', icon: SearchIcon },
]

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/caja': 'Gestión de Caja',
  '/ventas': 'Historial de Ventas',
  '/ventas/nueva': 'Nueva Venta',
  '/clientes': 'Clientes',
  '/creditos': 'Créditos',
  '/vehiculos': 'Vehículos',
  '/servicios': 'Servicios / Atenciones',
  '/servicios/nuevo': 'Nueva Atención',
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
  if (path === '/clientes/nuevo') return 'Nuevo Cliente'
  if (path.startsWith('/clientes/') && path.includes('/editar')) return 'Editar Cliente'
  if (path === '/vehiculos/nuevo') return 'Nuevo Vehículo'
  if (path.startsWith('/vehiculos/') && path.includes('/editar')) return 'Editar Vehículo'
  if (path.startsWith('/vehiculos/')) return 'Detalle del Vehículo'
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
  const location = useLocation()
  const { isOnline } = useOnlineStatus()
  const pageTitle = usePageTitle()
  const time = useClock()
  const [showMobileMenu, setShowMobileMenu] = useState(false)

  // Close drawer on route change
  useEffect(() => {
    setShowMobileMenu(false)
  }, [location.pathname])

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
          <nav className="flex-1 py-3 overflow-y-auto px-2 space-y-4">
            {navSections.map((section) => (
              <div key={section.label}>
                <p className="text-[10px] font-semibold uppercase tracking-widest px-3 py-1.5" style={{ color: '#475569' }}>
                  {section.label}
                </p>
                <div className="space-y-0.5">
                  {section.items.map(({ to, label, icon: Icon, exact }: { to: string; label: string; icon: React.ComponentType<{ className?: string }>; exact?: boolean }) => (
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
                </div>
              </div>
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
          background: 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <div className="grid grid-cols-5">
          {mobileNavItems.map(({ to, label, icon: Icon, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                `flex flex-col items-center py-2.5 px-1 text-[10px] font-medium transition-colors ${
                  isActive ? 'text-[#1F3864]' : 'text-gray-400'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`p-1.5 rounded-lg transition-colors ${isActive ? 'bg-[#1F3864]/10' : ''}`}>
                    <Icon className={`w-5 h-5 ${isActive ? 'text-[#1F3864]' : 'text-gray-400'}`} />
                  </div>
                  <span className="truncate mt-0.5">{label}</span>
                </>
              )}
            </NavLink>
          ))}

          {/* "Más" button */}
          <button
            onClick={() => setShowMobileMenu(true)}
            className={`flex flex-col items-center py-2.5 px-1 text-[10px] font-medium transition-colors ${
              showMobileMenu ? 'text-[#1F3864]' : 'text-gray-400'
            }`}
          >
            <div className={`p-1.5 rounded-lg transition-colors ${showMobileMenu ? 'bg-[#1F3864]/10' : ''}`}>
              <GridIcon className={`w-5 h-5 ${showMobileMenu ? 'text-[#1F3864]' : 'text-gray-400'}`} />
            </div>
            <span className="mt-0.5">Más</span>
          </button>
        </div>
      </nav>

      {/* ── Mobile Full Menu Drawer ───────────── */}
      {showMobileMenu && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 z-50 bg-black/40"
            style={{ backdropFilter: 'blur(2px)' }}
            onClick={() => setShowMobileMenu(false)}
          />

          {/* Drawer */}
          <div
            className="md:hidden fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl overflow-hidden"
            style={{
              background: '#0f172a',
              boxShadow: '0 -8px 32px rgba(0,0,0,0.4)',
              maxHeight: '80vh',
            }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {/* User info */}
            <div className="px-5 py-3 flex items-center gap-3 border-b border-white/5">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #0ea5e9, #1F3864)' }}
              >
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{user?.nombre}</p>
                <p className="text-xs text-slate-400">{formatRolUsuario(user?.rol ?? '')}</p>
              </div>
              <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            </div>

            {/* Nav sections */}
            <div className="overflow-y-auto px-3 py-3 space-y-4" style={{ maxHeight: 'calc(80vh - 130px)' }}>
              {navSections.map((section) => (
                <div key={section.label}>
                  <p className="text-[10px] font-semibold uppercase tracking-widest px-3 py-1 text-slate-500">
                    {section.label}
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    {section.items.map(({ to, label, icon: Icon, exact }: { to: string; label: string; icon: React.ComponentType<{ className?: string }>; exact?: boolean }) => (
                      <NavLink
                        key={to}
                        to={to}
                        end={exact}
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                            isActive
                              ? 'text-white'
                              : 'text-slate-400 hover:text-white hover:bg-white/5'
                          }`
                        }
                        style={({ isActive }) => isActive ? {
                          background: 'linear-gradient(90deg, rgba(14,165,233,0.2) 0%, rgba(14,165,233,0.08) 100%)',
                        } : {}}
                      >
                        {({ isActive }) => (
                          <>
                            <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-[#0ea5e9]' : 'text-slate-500'}`} />
                            {label}
                          </>
                        )}
                      </NavLink>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Sign out */}
            <div className="px-4 py-3 border-t border-white/5">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all"
              >
                <LogOutIcon className="w-4 h-4" />
                Cerrar sesión
              </button>
            </div>
          </div>
        </>
      )}
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

function CajaIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  )
}

function PosIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  )
}

function ReceiptIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  )
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )
}

function CreditIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  )
}

function GridIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

function WrenchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  )
}

function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  )
}

function CarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l3 1h4m2-5h4l2-5H9.5M13 16l3 1h1" />
    </svg>
  )
}

