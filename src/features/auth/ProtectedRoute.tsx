import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import type { RolUsuario } from '@/shared/types/database'

interface ProtectedRouteProps {
  allowedRoles?: RolUsuario[]
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-primary-700 flex items-center justify-center">
        <div className="text-center text-white">
          <svg className="animate-spin w-10 h-10 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-lg font-medium">Lubricentro E' Manuel</p>
          <p className="text-primary-200 text-sm mt-1">Cargando sistema...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(user.rol)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-800 mb-2">Acceso restringido</p>
          <p className="text-gray-500">No tienes permisos para ver esta sección.</p>
          <Navigate to="/" replace />
        </div>
      </div>
    )
  }

  return <Outlet />
}
