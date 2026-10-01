import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '@/shared/lib/supabase'
import type { AuthContextValue, UsuarioPerfil } from './types'

const AuthContext = createContext<AuthContextValue | null>(null)

const PERFIL_CACHE_KEY = 'lubricentro_perfil'

// Retries up to 3 times with 1s/2s delays — handles brief network unavailability on PWA cold start
async function fetchPerfil(authUserId: string): Promise<UsuarioPerfil | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('auth_user_id', authUserId)
        .eq('activo', true)
        .single()
      if (error) throw error
      
      const perfil = data as UsuarioPerfil
      localStorage.setItem(PERFIL_CACHE_KEY, JSON.stringify(perfil))
      return perfil
    } catch {
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
      }
    }
  }
  
  // Fallback to cache if network fails completely
  const cached = localStorage.getItem(PERFIL_CACHE_KEY)
  if (cached) {
    try {
      return JSON.parse(cached) as UsuarioPerfil
    } catch {
      return null
    }
  }
  return null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UsuarioPerfil | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function init() {
      const { data: { session } } = await supabase.auth.getSession()

      if (!mounted) return

      if (session?.user) {
        const perfil = await fetchPerfil(session.user.id)
        if (mounted) setUser(perfil)
      } else {
        localStorage.removeItem(PERFIL_CACHE_KEY)
      }

      if (mounted) setLoading(false)
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return
        if (event === 'INITIAL_SESSION') return

        if (session?.user) {
          const perfil = await fetchPerfil(session.user.id)
          if (mounted) setUser(perfil)
        } else {
          localStorage.removeItem(PERFIL_CACHE_KEY)
          if (mounted) setUser(null)
        }
      }
    )

    const timeout = setTimeout(() => {
      if (mounted) setLoading(false)
    }, 5000)

    return () => {
      mounted = false
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
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
    localStorage.removeItem(PERFIL_CACHE_KEY)
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
