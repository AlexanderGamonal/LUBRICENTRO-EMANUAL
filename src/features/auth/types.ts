import type { RolUsuario } from '@/shared/types/database'

export interface UsuarioPerfil {
  id: string
  auth_user_id: string | null
  sucursal_id: string
  nombre: string
  email: string | null
  rol: RolUsuario
  activo: boolean
}

export interface AuthContextValue {
  user: UsuarioPerfil | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}
