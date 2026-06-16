import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus'
import { formatRolUsuario } from '@/shared/utils/formatters'

const navItems = [
  { to: '/', label: 'Dashboard', icon: HomeIcon, exact: true },
  { to: '/productos', label: 'Productos', icon: PackageIcon },
  { to: '/inventario', label: 'Inventario', icon: ChartIcon },
  { to: '/busqueda', label: 'Búsqueda', icon: SearchIcon },
  { to: '/importacion', label: 'Importar', icon: UploadIcon },
]

export function AppLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { isOnline } = useOnlineStatus()

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Offline banner */}
      {!isOnline && (
        <div className="bg-yellow-400 text-yellow-900 text-sm font-medium text-center py-2 px-4 z-50">
          Sin conexión a internet. Algunas funciones no están disponibles.
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar desktop */}
        <aside className="hidden md:flex flex-col w-56 bg-primary-700 text-white flex-shrink-0">
          {/* Brand */}
          <div className="p-5 border-b border-primary-600">
            <h1 className="font-bold text-base leading-tight">Lubricentro E' Manuel</h1>
            <p className="text-primary-300 text-xs mt-0.5">Sistema POS</p>
          </div>

          {/* Nav */}
          <nav className="flex-1 py-4 overflow-y-auto">
            {navItems.map(({ to, label, icon: Icon, exact }) => (
              <NavLink
                key={to}
                to={to}
                end={exact}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-5 py-3 text-sm font-medium transition-colors duration-100 ${
                    isActive
                      ? 'bg-primary-600 text-white'
                      : 'text-primary-200 hover:bg-primary-600 hover:text-white'
                  }`
                }
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </NavLink>
            ))}
          </nav>

          {/* User info */}
          <div className="p-4 border-t border-primary-600">
            <p className="text-xs font-medium text-white truncate">{user?.nombre}</p>
            <p className="text-xs text-primary-300">{formatRolUsuario(user?.rol ?? '')}</p>
            <button
              onClick={handleSignOut}
              className="mt-3 text-xs text-primary-300 hover:text-white transition-colors"
            >
              Cerrar sesión
            </button>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top header (mobile) */}
          <header className="md:hidden bg-primary-700 text-white px-4 py-3 flex items-center justify-between">
            <h1 className="font-bold text-sm">Lubricentro E' Manuel</h1>
            <div className="text-xs text-primary-200">{user?.nombre}</div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Bottom nav (mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
        <div className="grid grid-cols-5">
          {navItems.map(({ to, label, icon: Icon, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                `flex flex-col items-center py-2 px-1 text-xs transition-colors ${
                  isActive ? 'text-primary-700 font-semibold' : 'text-gray-500'
                }`
              }
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span className="truncate">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

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
