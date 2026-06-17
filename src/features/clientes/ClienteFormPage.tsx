import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'

const clienteSchema = z
  .object({
    nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    tipo: z.enum(['natural', 'empresa']),
    ruc_dni: z.string().optional().or(z.literal('')),
    telefono: z.string().optional().or(z.literal('')),
    email: z
      .string()
      .optional()
      .or(z.literal(''))
      .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
        message: 'Email inválido',
      }),
    direccion: z.string().optional().or(z.literal('')),
  })
  .superRefine((data, ctx) => {
    if (!data.ruc_dni) return
    const val = data.ruc_dni.trim()
    if (!val) return
    if (data.tipo === 'natural' && val.length !== 8) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ruc_dni'],
        message: 'El DNI debe tener exactamente 8 dígitos',
      })
    }
    if (data.tipo === 'empresa' && val.length !== 11) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ruc_dni'],
        message: 'El RUC debe tener exactamente 11 dígitos',
      })
    }
    if (!/^\d+$/.test(val)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ruc_dni'],
        message: 'Solo se permiten números',
      })
    }
  })

type ClienteFormData = z.infer<typeof clienteSchema>

export default function ClienteFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ClienteFormData>({
    resolver: zodResolver(clienteSchema),
    defaultValues: {
      nombre: '',
      tipo: 'natural',
      ruc_dni: '',
      telefono: '',
      email: '',
      direccion: '',
    },
  })

  const tipoActual = watch('tipo')

  const { data: clienteData, isLoading: loadingCliente } = useQuery({
    queryKey: ['cliente', id],
    queryFn: async () => {
      if (!id) return null
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })

  useEffect(() => {
    if (clienteData) {
      reset({
        nombre: clienteData.nombre,
        tipo: clienteData.tipo,
        ruc_dni: clienteData.ruc_dni ?? '',
        telefono: clienteData.telefono ?? '',
        email: clienteData.email ?? '',
        direccion: clienteData.direccion ?? '',
      })
    }
  }, [clienteData, reset])

  async function onSubmit(data: ClienteFormData) {
    if (!user) return

    const payload = {
      nombre: data.nombre,
      tipo: data.tipo,
      ruc_dni: data.ruc_dni?.trim() || null,
      telefono: data.telefono?.trim() || null,
      email: data.email?.trim() || null,
      direccion: data.direccion?.trim() || null,
    }

    try {
      if (isEdit) {
        const { error } = await supabase
          .from('clientes')
          .update(payload)
          .eq('id', id!)
          .select()
          .single()
        if (error) throw error
        toast.success('Cliente actualizado correctamente')
      } else {
        const { error } = await supabase
          .from('clientes')
          .insert({ ...payload, sucursal_id: user.sucursal_id })
          .select()
          .single()
        if (error) throw error
        toast.success('Cliente creado correctamente')
      }

      await queryClient.invalidateQueries({ queryKey: ['clientes', user.sucursal_id] })
      if (isEdit) {
        await queryClient.invalidateQueries({ queryKey: ['cliente', id] })
      }
      navigate('/clientes')
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Error al guardar el cliente'
      toast.error(message)
    }
  }

  if (isEdit && loadingCliente) {
    return (
      <div className="animate-fade-in p-6 max-w-2xl mx-auto">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-6" />
        <div className="card p-6 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i}>
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mb-2" />
              <div className="h-10 bg-gray-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          {isEdit ? 'Editar Cliente' : 'Nuevo Cliente'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {isEdit
            ? 'Modifica los datos del cliente'
            : 'Completa los datos para registrar un nuevo cliente'}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="card p-6 space-y-5">
          {/* Nombre */}
          <div>
            <label className="label-text">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              {...register('nombre')}
              type="text"
              className="input-field"
              placeholder="Nombre completo o razón social"
              autoFocus
            />
            {errors.nombre && (
              <p className="error-text mt-1">{errors.nombre.message}</p>
            )}
          </div>

          {/* Tipo */}
          <div>
            <label className="label-text">
              Tipo de cliente <span className="text-red-500">*</span>
            </label>
            <Controller
              name="tipo"
              control={control}
              render={({ field }) => (
                <div className="flex gap-4 mt-2">
                  {(['natural', 'empresa'] as const).map((tipo) => (
                    <label
                      key={tipo}
                      className={`flex items-center gap-2.5 cursor-pointer px-4 py-2.5 rounded-lg border-2 transition-all ${
                        field.value === tipo
                          ? 'border-[#1F3864] bg-[#1F3864]/5 text-[#1F3864]'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        value={tipo}
                        checked={field.value === tipo}
                        onChange={() => field.onChange(tipo)}
                        className="sr-only"
                      />
                      <span
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          field.value === tipo ? 'border-[#1F3864]' : 'border-gray-300'
                        }`}
                      >
                        {field.value === tipo && (
                          <span className="w-2 h-2 rounded-full bg-[#1F3864]" />
                        )}
                      </span>
                      <span className="font-medium capitalize">
                        {tipo === 'natural' ? 'Persona Natural' : 'Empresa'}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            />
          </div>

          {/* RUC / DNI */}
          <div>
            <label className="label-text">
              {tipoActual === 'empresa' ? 'RUC (11 dígitos)' : 'DNI (8 dígitos)'}
            </label>
            <input
              {...register('ruc_dni')}
              type="text"
              inputMode="numeric"
              maxLength={tipoActual === 'empresa' ? 11 : 8}
              className="input-field"
              placeholder={tipoActual === 'empresa' ? '20XXXXXXXXX' : '12345678'}
            />
            {errors.ruc_dni && (
              <p className="error-text mt-1">{errors.ruc_dni.message}</p>
            )}
          </div>

          {/* Teléfono */}
          <div>
            <label className="label-text">Teléfono</label>
            <input
              {...register('telefono')}
              type="tel"
              className="input-field"
              placeholder="9XXXXXXXX"
            />
            {errors.telefono && (
              <p className="error-text mt-1">{errors.telefono.message}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="label-text">Correo electrónico</label>
            <input
              {...register('email')}
              type="email"
              className="input-field"
              placeholder="cliente@ejemplo.com"
            />
            {errors.email && (
              <p className="error-text mt-1">{errors.email.message}</p>
            )}
          </div>

          {/* Dirección */}
          <div>
            <label className="label-text">Dirección</label>
            <input
              {...register('direccion')}
              type="text"
              className="input-field"
              placeholder="Av. Ejemplo 123, Ciudad"
            />
            {errors.direccion && (
              <p className="error-text mt-1">{errors.direccion.message}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row gap-3 mt-6">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn-secondary flex-1 sm:flex-none sm:w-32"
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 py-2.5 px-6 text-white font-semibold rounded-lg transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #1F3864, #0ea5e9)' }}
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Guardando...
              </>
            ) : isEdit ? (
              'Guardar cambios'
            ) : (
              'Crear cliente'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
