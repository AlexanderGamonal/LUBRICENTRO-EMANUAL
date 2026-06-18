import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import { useDebounce } from '@/shared/hooks/useDebounce'

// ── Schema ──────────────────────────────────────────────────────────────────
const vehiculoSchema = z.object({
  placa: z
    .string()
    .min(6, 'La placa debe tener al menos 6 caracteres')
    .max(8, 'La placa no puede superar 8 caracteres')
    .transform((v) => v.toUpperCase().trim())
    .refine((v) => /^[A-Z0-9\-]+$/.test(v), {
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
    <div className="animate-fade-in p-6 max-w-2xl mx-auto">
      <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-6" />
      <div className="card p-6 space-y-5">
        {[...Array(6)].map((_, i) => (
          <div key={i}>
            <div className="h-4 w-28 bg-gray-200 rounded animate-pulse mb-2" />
            <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}

function ClienteCombobox({
  sucursalId,
  value,
  selectedNombre,
  onChange,
}: {
  sucursalId: string
  value: string
  selectedNombre: string
  onChange: (id: string, nombre: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebounce(searchInput, 250)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const { data: clientes = [], isLoading } = useQuery<ClienteOption[]>({
    queryKey: ['clientes-combobox', sucursalId, debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch.trim()) {
        const { data, error } = await supabase
          .from('clientes')
          .select('id, nombre, telefono')
          .eq('sucursal_id', sucursalId)
          .eq('activo', true)
          .order('nombre')
          .limit(20)
        if (error) throw error
        return data ?? []
      }
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nombre, telefono')
        .eq('sucursal_id', sucursalId)
        .eq('activo', true)
        .ilike('nombre', `%${debouncedSearch.trim()}%`)
        .order('nombre')
        .limit(20)
      if (error) throw error
      return data ?? []
    },
    enabled: open && !!sucursalId,
  })

  function handleSelect(cliente: ClienteOption) {
    onChange(cliente.id, cliente.nombre)
    setOpen(false)
    setSearchInput('')
  }

  function handleClear() {
    onChange('', '')
    setSearchInput('')
    setOpen(false)
  }

  const hasValue = !!value

  return (
    <div ref={wrapperRef} className="relative">
      <label className="label-text">Cliente asociado</label>

      {hasValue && !open ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white shadow-sm">
          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="text-sm font-medium text-gray-800 flex-1 truncate">{selectedNombre}</span>
          <button
            type="button"
            onClick={handleClear}
            className="text-gray-400 hover:text-red-500 transition-colors ml-1 flex-shrink-0"
            aria-label="Quitar cliente"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round" strokeWidth={2} />
              <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" strokeWidth={2} />
            </svg>
          </button>
        </div>
      ) : (
        <div className="relative">
          <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" strokeWidth={2} />
              <line x1="21" y1="21" x2="16.65" y2="16.65" strokeWidth={2} strokeLinecap="round" />
            </svg>
          </span>
          <input
            type="text"
            value={searchInput}
            placeholder="Buscar cliente por nombre..."
            className="input-field pl-9"
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setSearchInput(e.target.value)
              setOpen(true)
            }}
            autoComplete="off"
          />
        </div>
      )}

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {isLoading ? (
            <div className="p-3 space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : clientes.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-400">
              {debouncedSearch
                ? `No se encontraron clientes con "${debouncedSearch}"`
                : 'No hay clientes disponibles'}
            </div>
          ) : (
            <ul className="max-h-56 overflow-y-auto divide-y divide-gray-50">
              {clientes.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="w-full text-left px-4 py-2.5 hover:bg-[#1F3864]/5 transition-colors"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelect(c)}
                  >
                    <div className="text-sm font-medium text-gray-800">{c.nombre}</div>
                    {c.telefono && (
                      <div className="text-xs text-gray-400 mt-0.5">{c.telefono}</div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-gray-100 px-3 py-2">
            <button
              type="button"
              className="text-xs text-gray-400 hover:text-[#1F3864] transition-colors"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setOpen(false)
                setSearchInput('')
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
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
    <div className="animate-fade-in p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-[#1F3864] mb-4 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver
        </button>
        <h1 className="text-2xl font-bold text-[#1F3864]">
          {isEdit ? 'Editar Vehículo' : 'Nuevo Vehículo'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {isEdit
            ? 'Modifica los datos del vehículo'
            : 'Registra un nuevo vehículo en el sistema'}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="card p-6 space-y-5">

          {/* Placa */}
          <div>
            <label className="label-text">
              Placa <span className="text-red-500">*</span>
            </label>
            <Controller
              name="placa"
              control={control}
              render={({ field }) => (
                <input
                  {...field}
                  type="text"
                  className="input-field font-mono uppercase tracking-widest"
                  placeholder="ABC-123"
                  maxLength={8}
                  autoFocus
                  onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                />
              )}
            />
            {errors.placa && (
              <p className="error-text">{errors.placa.message}</p>
            )}
          </div>

          {/* Marca */}
          <div>
            <label className="label-text">Marca</label>
            <input
              {...register('marca_vehiculo')}
              type="text"
              className="input-field"
              placeholder="Ej: Toyota, Chevrolet, Hyundai..."
            />
          </div>

          {/* Modelo */}
          <div>
            <label className="label-text">Modelo</label>
            <input
              {...register('modelo')}
              type="text"
              className="input-field"
              placeholder="Ej: Corolla, Spark, Tucson..."
            />
          </div>

          {/* Año y Color — row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-text">Año</label>
              <input
                {...register('anio', {
                  setValueAs: (v) => (v === '' ? undefined : parseInt(v, 10)),
                })}
                type="number"
                inputMode="numeric"
                min={1900}
                max={2030}
                className="input-field"
                placeholder="2020"
              />
              {errors.anio && (
                <p className="error-text">{errors.anio.message}</p>
              )}
            </div>
            <div>
              <label className="label-text">Color</label>
              <input
                {...register('color')}
                type="text"
                className="input-field"
                placeholder="Ej: Blanco, Negro..."
              />
            </div>
          </div>

          {/* Cliente combobox */}
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
              'Registrar vehículo'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

