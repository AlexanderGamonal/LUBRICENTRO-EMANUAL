import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import { Button, Field, FormActions, PageHeader, RadioCardGroup, Skeleton } from '@/shared/ui'

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
      <div className="mx-auto max-w-2xl animate-fade-in p-4 sm:p-6" aria-busy="true">
        <Skeleton className="mb-6 h-8 w-48" />
        <div className="card space-y-4 p-6">
          {[...Array(5)].map((_, i) => (
            <div key={i}>
              <Skeleton className="mb-2 h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl animate-fade-in p-4 sm:p-6">
      <PageHeader
        back
        title={isEdit ? 'Editar cliente' : 'Nuevo cliente'}
        description={isEdit ? 'Modifica los datos del cliente' : 'Completa los datos para registrar un nuevo cliente'}
      />

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="card space-y-5 p-4 sm:p-6">
          <Field label="Nombre" required error={errors.nombre?.message}>
            {(p) => (
              <input
                {...p}
                {...register('nombre')}
                type="text"
                autoComplete="off"
                className="input-field"
                placeholder="Nombre completo o razón social"
                autoFocus
              />
            )}
          </Field>

          <Controller
            name="tipo"
            control={control}
            render={({ field }) => (
              <RadioCardGroup
                legend="Tipo de cliente"
                required
                value={field.value}
                onChange={field.onChange}
                options={[
                  { value: 'natural', label: 'Persona natural' },
                  { value: 'empresa', label: 'Empresa' },
                ]}
              />
            )}
          />

          <Field label={tipoActual === 'empresa' ? 'RUC (11 dígitos)' : 'DNI (8 dígitos)'} error={errors.ruc_dni?.message}>
            {(p) => (
              <input
                {...p}
                {...register('ruc_dni')}
                type="text"
                inputMode="numeric"
                maxLength={tipoActual === 'empresa' ? 11 : 8}
                className="input-field"
                placeholder={tipoActual === 'empresa' ? '20XXXXXXXXX' : '12345678'}
              />
            )}
          </Field>

          <Field label="Teléfono" error={errors.telefono?.message}>
            {(p) => <input {...p} {...register('telefono')} type="tel" inputMode="tel" autoComplete="off" className="input-field" placeholder="9XXXXXXXX" />}
          </Field>

          <Field label="Correo electrónico" error={errors.email?.message}>
            {(p) => (
              <input {...p} {...register('email')} type="email" inputMode="email" autoComplete="off" className="input-field" placeholder="cliente@ejemplo.com" />
            )}
          </Field>

          <Field label="Dirección" error={errors.direccion?.message}>
            {(p) => <input {...p} {...register('direccion')} type="text" autoComplete="off" className="input-field" placeholder="Av. Ejemplo 123, Ciudad" />}
          </Field>
        </div>

        <FormActions>
          <Button variant="secondary" onClick={() => navigate(-1)} disabled={isSubmitting} className="sm:w-32">
            Cancelar
          </Button>
          <Button type="submit" loading={isSubmitting} className="sm:px-6">
            {isSubmitting ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear cliente'}
          </Button>
        </FormActions>
      </form>
    </div>
  )
}
