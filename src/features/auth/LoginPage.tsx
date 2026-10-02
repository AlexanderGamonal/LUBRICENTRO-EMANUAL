import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { Droplets, Eye, EyeOff } from 'lucide-react'
import { Button, Field } from '@/shared/ui'
import { useAuth } from './AuthProvider'

const loginSchema = z.object({
  email: z.string().email('Ingresa un correo válido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
})

type LoginForm = z.infer<typeof loginSchema>

export function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data: LoginForm) {
    setErrorMsg(null)
    try {
      await signIn(data.email, data.password)
      navigate('/', { replace: true })
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al iniciar sesión')
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-primary-700 p-4 pb-safe-b pt-safe-t">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-primary-700 shadow-lg">
            <Droplets className="h-9 w-9" aria-hidden="true" />
          </div>
          <h1 className="font-display text-2xl font-bold text-white">Lubricentro E&apos; Manuel</h1>
          <p className="mt-1 text-sm text-primary-100">Sistema de Punto de Venta</p>
        </div>

        <div className="rounded-2xl bg-card p-6 shadow-xl sm:p-8">
          <h2 className="mb-6 text-lg font-semibold text-fg">Iniciar sesión</h2>

          {errorMsg && (
            <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <Field label="Correo electrónico" error={errors.email?.message}>
              {(p) => (
                <input
                  {...p}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoFocus
                  {...register('email')}
                  className="input-field"
                  placeholder="correo@ejemplo.com"
                />
              )}
            </Field>

            <Field label="Contraseña" error={errors.password?.message}>
              {(p) => (
                <div className="relative">
                  <input
                    {...p}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    {...register('password')}
                    className="input-field pr-12"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    aria-pressed={showPassword}
                    className="absolute right-1 top-1/2 flex h-[40px] w-[40px] -translate-y-1/2 items-center justify-center rounded-lg text-fg-subtle transition-colors hover:text-fg"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </div>
              )}
            </Field>

            <Button type="submit" size="lg" block loading={isSubmitting} className="mt-2">
              {isSubmitting ? 'Ingresando…' : 'Ingresar'}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-primary-100">RUC: 10106614267 · SJL, Lima, Perú</p>
      </div>
    </main>
  )
}
