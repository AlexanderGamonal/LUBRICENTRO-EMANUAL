import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import { Button, Field, FormActions, PageHeader, Skeleton } from '@/shared/ui'
import { ClienteCombobox } from '@/features/clientes/ClienteCombobox'

// ── Schema ──────────────────────────────────────────────────────────────────
const vehiculoSchema = z.object({
  placa: z
    .string()
    .min(6, 'La placa debe tener al menos 6 caracteres')
    .max(8, 'La placa no puede superar 8 caracteres')
    .transform((v) => v.toUpperCase().trim())
    .refine((v) => /^[A-Z0-9-]+$/.test(v), {
      message: 'Solo letras, números y guiones',
    }),
  marca_vehiculo: z.string().optional().or(z.literal('')),
  modelo: z.string().optional().or(z.literal('')),
  anio: z
    .union([z.number().int().min(1900, 'Año mínimo 1900').max(2030, 'Año máximo 2030'), z.nan()])
    .optional()
    .nullable(),
  color: z.string().optional().or(z.literal('')),
  cliente_id: z.string().uuid().optional().or(z.literal('')),
})

type VehiculoFormData = z.infer<typeof vehiculoSchema>

// ── Types ────────────────────────────────────────────────────────────────────
type ClienteOption = {
  id: string
  nombre: string
  telefono: string | null
}

type VehiculoExistente = {
  id: string
  placa: string
  marca_vehiculo: string | null
  modelo: string | null
  anio: number | null
  color: string | null
  cliente_id: string | null
  clientes: ClienteOption | null
}

// ── Sub-components ───────────────────────────────────────────────────────────
function FormSkeleton() {
  return (
    <div className="mx-auto max-w-2xl animate-fade-in p-4 sm:p-6" aria-busy="true">
      <Skeleton className="mb-6 h-8 w-48" />
      <div className="card space-y-5 p-6">
        {[...Array(6)].map((_, i) => (
          <div key={i}>
            <Skeleton className="mb-2 h-4 w-28" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function VehiculoFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  // Separate state to track the selected cliente name for the combobox display
  const [selectedClienteNombre, setSelectedClienteNombre] = useState('')

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<VehiculoFormData>({
    resolver: zodResolver(vehiculoSchema),
    defaultValues: {
      placa: '',
      marca_vehiculo: '',
      modelo: '',
      anio: undefined,
      color: '',
      cliente_id: '',
    },
  })

  // Fetch existing vehicle in edit mode
  const { data: vehiculoData, isLoading: loadingVehiculo } = useQuery({
    queryKey: ['vehiculo', id],
    queryFn: async () => {
      if (!id) return null
      const { data, error } = await supabase
        .from('vehiculos')
        .select('id, placa, marca_vehiculo, modelo, anio, color, cliente_id, clientes(id, nombre, telefono)')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as unknown as VehiculoExistente
    },
    enabled: !!id,
  })

  // Pre-fill form when editing
  useEffect(() => {
    if (vehiculoData) {
      reset({
        placa: vehiculoData.placa,
        marca_vehiculo: vehiculoData.marca_vehiculo ?? '',
        modelo: vehiculoData.modelo ?? '',
        anio: vehiculoData.anio ?? undefined,
        color: vehiculoData.color ?? '',
        cliente_id: vehiculoData.cliente_id ?? '',
      })
      if (vehiculoData.clientes) {
        setSelectedClienteNombre(vehiculoData.clientes.nombre)
      }
    }
  }, [vehiculoData, reset])

  async function onSubmit(data: VehiculoFormData) {
    if (!user) return

    const payload = {
      placa: data.placa,
      marca_vehiculo: data.marca_vehiculo?.trim() || null,
      modelo: data.modelo?.trim() || null,
      anio: data.anio ?? null,
      color: data.color?.trim() || null,
      cliente_id: data.cliente_id?.trim() || null,
    }

    try {
      if (isEdit) {
        const { error } = await supabase
          .from('vehiculos')
          .update(payload)
          .eq('id', id!)
        if (error) throw error

        toast.success('Vehículo actualizado correctamente')
        await queryClient.invalidateQueries({ queryKey: ['vehiculo', id] })
        await queryClient.invalidateQueries({ queryKey: ['vehiculos', user.sucursal_id] })
        navigate(`/vehiculos/${id}`)
      } else {
        const { data: created, error } = await supabase
          .from('vehiculos')
          .insert({ ...payload, sucursal_id: user.sucursal_id })
          .select('id')
          .single()
        if (error) throw error

        toast.success('Vehículo registrado correctamente')
        await queryClient.invalidateQueries({ queryKey: ['vehiculos', user.sucursal_id] })
        navigate(`/vehiculos/${created.id}`)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al guardar el vehículo'
      toast.error(message)
    }
  }

  if (isEdit && loadingVehiculo) {
    return <FormSkeleton />
  }

  const sucursalId = user?.sucursal_id ?? ''

  return (
    <div className="mx-auto max-w-2xl animate-fade-in p-4 sm:p-6">
      <PageHeader
        back
        title={isEdit ? 'Editar vehículo' : 'Nuevo vehículo'}
        description={isEdit ? 'Modifica los datos del vehículo' : 'Registra un nuevo vehículo en el sistema'}
      />

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="card space-y-5 p-4 sm:p-6">
          <Controller
            name="placa"
            control={control}
            render={({ field }) => (
              <Field label="Placa" required error={errors.placa?.message}>
                {(p) => (
                  <input
                    {...p}
                    {...field}
                    type="text"
                    autoCapitalize="characters"
                    autoComplete="off"
                    className="input-field font-mono uppercase tracking-widest"
                    placeholder="ABC-123"
                    maxLength={8}
                    autoFocus
                    onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                  />
                )}
              </Field>
            )}
          />

          <Field label="Marca">
            {(p) => <input {...p} {...register('marca_vehiculo')} type="text" className="input-field" placeholder="Ej: Toyota, Chevrolet, Hyundai..." />}
          </Field>

          <Field label="Modelo">
            {(p) => <input {...p} {...register('modelo')} type="text" className="input-field" placeholder="Ej: Corolla, Spark, Tucson..." />}
          </Field>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-4">
            <Field label="Año" error={errors.anio?.message}>
              {(p) => (
                <input
                  {...p}
                  {...register('anio', { setValueAs: (v) => (v === '' ? undefined : parseInt(v, 10)) })}
                  type="number"
                  inputMode="numeric"
                  min={1900}
                  max={2030}
                  className="input-field"
                  placeholder="2020"
                />
              )}
            </Field>
            <Field label="Color">
              {(p) => <input {...p} {...register('color')} type="text" className="input-field" placeholder="Ej: Blanco, Negro..." />}
            </Field>
          </div>

          <Controller
            name="cliente_id"
            control={control}
            render={({ field }) => (
              <ClienteCombobox
                sucursalId={sucursalId}
                value={field.value ?? ''}
                selectedNombre={selectedClienteNombre}
                onChange={(clienteId, nombre) => {
                  field.onChange(clienteId)
                  setSelectedClienteNombre(nombre)
                }}
              />
            )}
          />
        </div>

        <FormActions>
          <Button variant="secondary" onClick={() => navigate(-1)} disabled={isSubmitting} className="sm:w-32">
            Cancelar
          </Button>
          <Button type="submit" loading={isSubmitting} className="sm:px-6">
            {isSubmitting ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Registrar vehículo'}
          </Button>
        </FormActions>
      </form>
    </div>
  )
}
