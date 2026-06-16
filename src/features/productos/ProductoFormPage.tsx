import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import { useProductoMutations } from './hooks/useProductos'
import { productoSchema, type ProductoFormData } from './schemas/productoSchema'
import type { Database } from '@/shared/types/database'

type Ubicacion = Database['public']['Tables']['ubicaciones']['Row']
type Categoria = Database['public']['Tables']['categorias']['Row']

interface ProductoFormPageProps {
  mode: 'create' | 'edit'
}

export function ProductoFormPage({ mode }: ProductoFormPageProps) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { crearProducto, actualizarProducto } = useProductoMutations()

  const [zona, setZona] = useState('')
  const [estante, setEstante] = useState('')
  const [nivelSel, setNivelSel] = useState('')
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProductoFormData>({
    resolver: zodResolver(productoSchema),
    defaultValues: {
      costo: 0,
      stock_minimo: 0,
      stock_inicial: 0,
      tiene_codigo_barras: false,
      activo: true,
    },
  })

  // Cargar producto existente en modo edición
  const { data: productoExistente, isLoading: loadingProducto } = useQuery({
    queryKey: ['producto-raw', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vw_productos_detalle')
        .select('*')
        .eq('id', id!)
        .eq('sucursal_id', user!.sucursal_id)
        .single()
      if (error) throw error
      return data
    },
    enabled: mode === 'edit' && !!id && !!user,
  })

  useEffect(() => {
    if (productoExistente) {
      reset({
        codigo_interno: productoExistente.codigo_interno,
        codigo_barras: productoExistente.codigo_barras ?? '',
        nombre: productoExistente.nombre,
        marca: productoExistente.marca ?? '',
        viscosidad_especificacion: productoExistente.viscosidad_especificacion ?? '',
        categoria_id: productoExistente.categoria_id ?? '',
        ubicacion_id: productoExistente.ubicacion_id ?? '',
        precio_venta: productoExistente.precio_venta,
        costo: productoExistente.costo,
        stock_minimo: productoExistente.stock_minimo,
        tiene_codigo_barras: productoExistente.tiene_codigo_barras,
        activo: productoExistente.activo,
      })
      if (productoExistente.zona) setZona(productoExistente.zona)
      if (productoExistente.estante != null)
        setEstante(String(productoExistente.estante))
      if (productoExistente.nivel != null)
        setNivelSel(String(productoExistente.nivel))
      if (productoExistente.foto_url) setFotoPreview(productoExistente.foto_url)
    }
  }, [productoExistente, reset])

  // Cargar categorías
  const { data: categorias } = useQuery<Categoria[]>({
    queryKey: ['categorias', user?.sucursal_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categorias')
        .select('*')
        .eq('sucursal_id', user!.sucursal_id)
        .eq('activa', true)
        .order('nombre')
      if (error) throw error
      return data
    },
    enabled: !!user,
  })

  // Cargar todas las ubicaciones
  const { data: ubicaciones } = useQuery<Ubicacion[]>({
    queryKey: ['ubicaciones', user?.sucursal_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ubicaciones')
        .select('*')
        .eq('sucursal_id', user!.sucursal_id)
        .eq('activa', true)
        .order('zona')
        .order('estante')
        .order('nivel')
      if (error) throw error
      return data
    },
    enabled: !!user,
  })

  // Derivar zonas, estantes y niveles disponibles
  const zonas = [...new Set((ubicaciones ?? []).map((u) => u.zona))].sort()

  const estantes = [
    ...new Set(
      (ubicaciones ?? [])
        .filter((u) => !zona || u.zona === zona)
        .map((u) => u.estante),
    ),
  ].sort((a, b) => a - b)

  const niveles = (ubicaciones ?? [])
    .filter(
      (u) =>
        (!zona || u.zona === zona) &&
        (!estante || u.estante === Number(estante)),
    )
    .sort((a, b) => a.nivel - b.nivel)

  // Cuando se selecciona nivel, buscar la ubicacion_id correspondiente
  useEffect(() => {
    if (zona && estante && nivelSel) {
      const ub = ubicaciones?.find(
        (u) =>
          u.zona === zona &&
          u.estante === Number(estante) &&
          u.nivel === Number(nivelSel),
      )
      setValue('ubicacion_id', ub?.id ?? '')
    } else {
      setValue('ubicacion_id', '')
    }
  }, [zona, estante, nivelSel, ubicaciones, setValue])

  function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFotoFile(file)
    setFotoPreview(URL.createObjectURL(file))
  }

  async function uploadFoto(productoId: string): Promise<string | null> {
    if (!fotoFile) return null
    const ext = fotoFile.name.split('.').pop()
    const path = `${productoId}.${ext}`
    const { error } = await supabase.storage
      .from('product-images')
      .upload(path, fotoFile, { upsert: true })
    if (error) {
      toast.error('Error subiendo imagen: ' + error.message)
      return null
    }
    const { data } = supabase.storage.from('product-images').getPublicUrl(path)
    return data.publicUrl
  }

  const onSubmit = async (formData: ProductoFormData) => {
    if (!user) return

    try {
      if (mode === 'create') {
        const stockInicial = formData.stock_inicial ?? 0
        setUploading(true)

        const insertData = {
          sucursal_id: user.sucursal_id,
          codigo_interno: formData.codigo_interno,
          codigo_barras: formData.codigo_barras || null,
          nombre: formData.nombre,
          marca: formData.marca || null,
          viscosidad_especificacion: formData.viscosidad_especificacion || null,
          categoria_id: formData.categoria_id || null,
          ubicacion_id: formData.ubicacion_id || null,
          precio_venta: formData.precio_venta,
          costo: formData.costo ?? 0,
          stock_actual: stockInicial,
          stock_minimo: formData.stock_minimo ?? 0,
          tiene_codigo_barras: formData.tiene_codigo_barras ?? false,
          foto_url: null as string | null,
          activo: formData.activo ?? true,
        }

        const prod = await crearProducto.mutateAsync(insertData)
        setUploading(false)

        if (prod && fotoFile) {
          setUploading(true)
          const url = await uploadFoto(prod.id)
          if (url) {
            await supabase
              .from('productos')
              .update({ foto_url: url })
              .eq('id', prod.id)
          }
          setUploading(false)
        }

        if (prod && stockInicial > 0) {
          await supabase.rpc('registrar_movimiento_stock', {
            p_producto_id: prod.id,
            p_tipo: 'entrada',
            p_cantidad: stockInicial,
            p_motivo: 'Stock inicial al crear producto',
          })
        }

        navigate('/productos')
      } else {
        if (!id) return
        setUploading(true)
        let fotoUrl: string | null = productoExistente?.foto_url ?? null
        if (fotoFile) {
          fotoUrl = await uploadFoto(id)
        }
        setUploading(false)

        await actualizarProducto.mutateAsync({
          id,
          codigo_interno: formData.codigo_interno,
          codigo_barras: formData.codigo_barras || null,
          nombre: formData.nombre,
          marca: formData.marca || null,
          viscosidad_especificacion: formData.viscosidad_especificacion || null,
          categoria_id: formData.categoria_id || null,
          ubicacion_id: formData.ubicacion_id || null,
          precio_venta: formData.precio_venta,
          costo: formData.costo ?? 0,
          stock_minimo: formData.stock_minimo ?? 0,
          tiene_codigo_barras: formData.tiene_codigo_barras ?? false,
          foto_url: fotoUrl,
          activo: formData.activo ?? true,
        })

        navigate('/productos')
      }
    } catch (err) {
      setUploading(false)
      toast.error(err instanceof Error ? err.message : 'Error al guardar producto')
    }
  }

  const isBusy = isSubmitting || uploading || crearProducto.isPending || actualizarProducto.isPending

  if (mode === 'edit' && loadingProducto) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="h-10 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {mode === 'create' ? 'Nuevo Producto' : 'Editar Producto'}
        </h1>
        <button
          type="button"
          onClick={() => navigate('/productos')}
          className="btn-secondary"
        >
          Cancelar
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Sección: Identificación */}
        <div className="card">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            Identificación
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-text">Código Interno *</label>
              <input
                {...register('codigo_interno')}
                className="input-field"
                placeholder="Ej. PRD-001"
              />
              {errors.codigo_interno && (
                <p className="error-text">{errors.codigo_interno.message}</p>
              )}
            </div>
            <div>
              <label className="label-text">Código de Barras</label>
              <input
                {...register('codigo_barras')}
                className="input-field"
                placeholder="Ej. 7891234567890"
              />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input
              type="checkbox"
              id="tiene_codigo_barras"
              {...register('tiene_codigo_barras')}
              className="rounded border-gray-300"
            />
            <label htmlFor="tiene_codigo_barras" className="text-sm text-gray-700">
              Tiene código de barras físico
            </label>
          </div>
        </div>

        {/* Sección: Datos del Producto */}
        <div className="card">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            Datos del Producto
          </h2>
          <div className="space-y-4">
            <div>
              <label className="label-text">Nombre *</label>
              <input
                {...register('nombre')}
                className="input-field"
                placeholder="Ej. Aceite Mobil 20W-50 1L"
              />
              {errors.nombre && (
                <p className="error-text">{errors.nombre.message}</p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label-text">Marca</label>
                <input
                  {...register('marca')}
                  className="input-field"
                  placeholder="Ej. Mobil"
                />
              </div>
              <div>
                <label className="label-text">Viscosidad / Especificación</label>
                <input
                  {...register('viscosidad_especificacion')}
                  className="input-field"
                  placeholder="Ej. 20W-50, API SL"
                />
              </div>
            </div>
            <div>
              <label className="label-text">Categoría</label>
              <select {...register('categoria_id')} className="input-field">
                <option value="">Sin categoría</option>
                {categorias?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Sección: Ubicación en almacén */}
        <div className="card">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            Ubicación en Almacén
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label-text">Zona</label>
              <select
                value={zona}
                onChange={(e) => {
                  setZona(e.target.value)
                  setEstante('')
                  setNivelSel('')
                }}
                className="input-field"
              >
                <option value="">Sin zona</option>
                {zonas.map((z) => (
                  <option key={z} value={z}>
                    Zona {z}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-text">Estante</label>
              <select
                value={estante}
                onChange={(e) => {
                  setEstante(e.target.value)
                  setNivelSel('')
                }}
                className="input-field"
                disabled={!zona}
              >
                <option value="">—</option>
                {estantes.map((e) => (
                  <option key={e} value={String(e)}>
                    Estante {e}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-text">Nivel</label>
              <select
                value={nivelSel}
                onChange={(e) => setNivelSel(e.target.value)}
                className="input-field"
                disabled={!estante}
              >
                <option value="">—</option>
                {niveles.map((u) => (
                  <option key={u.id} value={String(u.nivel)}>
                    Nivel {u.nivel} ({u.codigo})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Sección: Precios y Stock */}
        <div className="card">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            Precios y Stock
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label-text">Precio de Venta (S/.) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                {...register('precio_venta', { valueAsNumber: true })}
                className="input-field"
                placeholder="0.00"
              />
              {errors.precio_venta && (
                <p className="error-text">{errors.precio_venta.message}</p>
              )}
            </div>
            <div>
              <label className="label-text">Costo (S/.)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                {...register('costo', { valueAsNumber: true })}
                className="input-field"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="label-text">Stock Mínimo</label>
              <input
                type="number"
                min="0"
                step="1"
                {...register('stock_minimo', { valueAsNumber: true })}
                className="input-field"
                placeholder="0"
              />
            </div>
          </div>
          {mode === 'create' && (
            <div className="mt-4">
              <label className="label-text">Stock Inicial</label>
              <input
                type="number"
                min="0"
                step="1"
                {...register('stock_inicial', { valueAsNumber: true })}
                className="input-field max-w-xs"
                placeholder="0"
              />
              <p className="text-xs text-gray-400 mt-1">
                Se registrará como movimiento de entrada
              </p>
            </div>
          )}
        </div>

        {/* Sección: Foto */}
        <div className="card">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            Foto del Producto
          </h2>
          <div className="flex items-start gap-4">
            {fotoPreview ? (
              <img
                src={fotoPreview}
                alt="Vista previa"
                className="w-24 h-24 object-cover rounded-lg border border-gray-200"
              />
            ) : (
              <div className="w-24 h-24 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 text-xs text-center">
                Sin foto
              </div>
            )}
            <div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-secondary text-sm"
              >
                {fotoPreview ? 'Cambiar foto' : 'Subir foto'}
              </button>
              <p className="text-xs text-gray-400 mt-1">
                JPG, PNG o WEBP. Máx 2MB.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFotoChange}
                className="hidden"
              />
            </div>
          </div>
        </div>

        {/* Estado (solo en edición) */}
        {mode === 'edit' && (
          <div className="card">
            <h2 className="text-base font-semibold text-gray-800 mb-4">
              Estado
            </h2>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="activo"
                {...register('activo')}
                className="rounded border-gray-300"
              />
              <label htmlFor="activo" className="text-sm text-gray-700">
                Producto activo (visible en ventas y búsquedas)
              </label>
            </div>
          </div>
        )}

        {/* Botones */}
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={() => navigate('/productos')}
            className="btn-secondary"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isBusy}
            className="btn-primary min-w-[140px]"
          >
            {isBusy
              ? 'Guardando...'
              : mode === 'create'
              ? 'Crear Producto'
              : 'Guardar Cambios'}
          </button>
        </div>
      </form>
    </div>
  )
}
