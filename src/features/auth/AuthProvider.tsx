import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '@/shared/lib/supabase'
import type { AuthContextValue, UsuarioPerfil } from './types'

const AuthContext = createContext<AuthContextValue | null>(null)

async function fetchPerfil(authUserId: string): Promise<UsuarioPerfil | null> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('auth_user_id', authUserId)
    .eq('activo', true)
    .single()

  if (error || !data) return null
  return data as UsuarioPerfil
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UsuarioPerfil | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const perfil = await fetchPerfil(session.user.id)
        setUser(perfil)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          const perfil = await fetchPerfil(session.user.id)
          setUser(perfil)
        } else {
          setUser(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        throw new Error('Correo o contraseña incorrectos')
      }
      throw new Error('Error al iniciar sesión. Intenta de nuevo.')
    }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
