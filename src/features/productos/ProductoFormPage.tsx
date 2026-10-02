import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import { Button, Field, FormActions, PageHeader, Skeleton } from '@/shared/ui'
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
  const { actualizarProducto } = useProductoMutations()

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

        // Usamos la RPC crear_producto que es atómica:
        // inserta con stock=0 y registra la entrada en la misma transacción.
        // Así nunca queda un producto con stock_actual incorrecto si algo falla.
        const { data: rpcResult, error: rpcError } = await supabase.rpc('crear_producto', {
          p_sucursal_id:               user.sucursal_id,
          p_codigo_interno:            formData.codigo_interno,
          p_nombre:                    formData.nombre,
          p_precio_venta:              formData.precio_venta,
          p_costo:                     formData.costo ?? 0,
          p_stock_inicial:             stockInicial,
          p_stock_minimo:              formData.stock_minimo ?? 0,
          p_categoria_id:              formData.categoria_id || null,
          p_ubicacion_id:              formData.ubicacion_id || null,
          p_codigo_barras:             formData.codigo_barras || null,
          p_marca:                     formData.marca || null,
          p_viscosidad_especificacion: formData.viscosidad_especificacion || null,
          p_tiene_codigo_barras:       formData.tiene_codigo_barras ?? false,
          p_foto_url:                  null,
        })

        setUploading(false)

        if (rpcError) {
          toast.error('Error al crear el producto: ' + rpcError.message)
          return
        }

        const productoId = (rpcResult as { producto_id: string } | null)?.producto_id

        if (productoId && fotoFile) {
          setUploading(true)
          const url = await uploadFoto(productoId)
          if (url) {
            await supabase
              .from('productos')
              .update({ foto_url: url })
              .eq('id', productoId)
          }
          setUploading(false)
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

  const isBusy = isSubmitting || uploading || actualizarProducto.isPending

  if (mode === 'edit' && loadingProducto) {
    return (
      <div className="mx-auto max-w-3xl p-4 sm:p-6" aria-busy="true">
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((n) => (
            <Skeleton key={n} className="h-10 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <PageHeader back title={mode === 'create' ? 'Nuevo producto' : 'Editar producto'} />

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-5">
          <section className="card p-4 sm:p-6" aria-labelledby="sec-ident">
            <h2 id="sec-ident" className="mb-4 text-base font-semibold text-fg">
              Identificación
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Código interno" required error={errors.codigo_interno?.message}>
                {(p) => <input {...p} {...register('codigo_interno')} className="input-field" placeholder="Ej. PRD-001" autoComplete="off" />}
              </Field>
              <Field label="Código de barras">
                {(p) => (
                  <input {...p} {...register('codigo_barras')} inputMode="numeric" className="input-field" placeholder="Ej. 7891234567890" autoComplete="off" />
                )}
              </Field>
            </div>
            <label htmlFor="tiene_codigo_barras" className="mt-4 flex min-h-touch cursor-pointer items-center gap-2.5 text-sm text-fg-muted md:min-h-0">
              <input type="checkbox" id="tiene_codigo_barras" {...register('tiene_codigo_barras')} className="h-4 w-4 rounded border-line" />
              Tiene código de barras físico
            </label>
          </section>

          <section className="card p-4 sm:p-6" aria-labelledby="sec-datos">
            <h2 id="sec-datos" className="mb-4 text-base font-semibold text-fg">
              Datos del producto
            </h2>
            <div className="space-y-4">
              <Field label="Nombre" required error={errors.nombre?.message}>
                {(p) => <input {...p} {...register('nombre')} className="input-field" placeholder="Ej. Aceite Mobil 20W-50 1L" autoComplete="off" />}
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Marca">
                  {(p) => <input {...p} {...register('marca')} className="input-field" placeholder="Ej. Mobil" autoComplete="off" />}
                </Field>
                <Field label="Viscosidad / especificación">
                  {(p) => <input {...p} {...register('viscosidad_especificacion')} className="input-field" placeholder="Ej. 20W-50, API SL" autoComplete="off" />}
                </Field>
              </div>
              <Field label="Categoría">
                {(p) => (
                  <select {...p} {...register('categoria_id')} className="input-field">
                    <option value="">Sin categoría</option>
                    {categorias?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
          </section>

          <section className="card p-4 sm:p-6" aria-labelledby="sec-ubic">
            <h2 id="sec-ubic" className="mb-4 text-base font-semibold text-fg">
              Ubicación en almacén
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Zona">
                {(p) => (
                  <select
                    {...p}
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
                )}
              </Field>
              <Field label="Estante">
                {(p) => (
                  <select
                    {...p}
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
                )}
              </Field>
              <Field label="Nivel">
                {(p) => (
                  <select {...p} value={nivelSel} onChange={(e) => setNivelSel(e.target.value)} className="input-field" disabled={!estante}>
                    <option value="">—</option>
                    {niveles.map((u) => (
                      <option key={u.id} value={String(u.nivel)}>
                        Nivel {u.nivel} ({u.codigo})
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
          </section>

          <section className="card p-4 sm:p-6" aria-labelledby="sec-precios">
            <h2 id="sec-precios" className="mb-4 text-base font-semibold text-fg">
              Precios y stock
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Precio de venta (S/)" required error={errors.precio_venta?.message}>
                {(p) => (
                  <input
                    {...p}
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    {...register('precio_venta', { valueAsNumber: true })}
                    className="input-field"
                    placeholder="0.00"
                  />
                )}
              </Field>
              <Field label="Costo (S/)">
                {(p) => (
                  <input
                    {...p}
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    {...register('costo', { valueAsNumber: true })}
                    className="input-field"
                    placeholder="0.00"
                  />
                )}
              </Field>
              <Field label="Stock mínimo">
                {(p) => (
                  <input {...p} type="number" inputMode="numeric" min="0" step="1" {...register('stock_minimo', { valueAsNumber: true })} className="input-field" placeholder="0" />
                )}
              </Field>
            </div>
            {mode === 'create' && (
              <Field label="Stock inicial" hint="Se registrará como movimiento de entrada" className="mt-4 sm:max-w-xs">
                {(p) => (
                  <input {...p} type="number" inputMode="numeric" min="0" step="1" {...register('stock_inicial', { valueAsNumber: true })} className="input-field" placeholder="0" />
                )}
              </Field>
            )}
          </section>

          <section className="card p-4 sm:p-6" aria-labelledby="sec-foto">
            <h2 id="sec-foto" className="mb-4 text-base font-semibold text-fg">
              Foto del producto
            </h2>
            <div className="flex items-start gap-4">
              {fotoPreview ? (
                <img src={fotoPreview} alt="Vista previa del producto" className="h-24 w-24 rounded-lg border border-line object-cover" />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-line bg-muted text-center text-xs text-fg-subtle">Sin foto</div>
              )}
              <div>
                <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                  {fotoPreview ? 'Cambiar foto' : 'Subir foto'}
                </Button>
                <p className="mt-1 text-xs text-fg-subtle">JPG, PNG o WEBP. Máx 2MB.</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFotoChange}
                  className="hidden"
                  aria-label="Seleccionar foto del producto"
                />
              </div>
            </div>
          </section>

          {mode === 'edit' && (
            <section className="card p-4 sm:p-6" aria-labelledby="sec-estado">
              <h2 id="sec-estado" className="mb-4 text-base font-semibold text-fg">
                Estado
              </h2>
              <label htmlFor="activo" className="flex min-h-touch cursor-pointer items-center gap-2.5 text-sm text-fg-muted md:min-h-0">
                <input type="checkbox" id="activo" {...register('activo')} className="h-4 w-4 rounded border-line" />
                Producto activo (visible en ventas y búsquedas)
              </label>
            </section>
          )}
        </div>

        <FormActions align="end">
          <Button variant="secondary" onClick={() => navigate('/productos')} disabled={isBusy}>
            Cancelar
          </Button>
          <Button type="submit" loading={isBusy} className="sm:min-w-[140px]">
            {isBusy ? 'Guardando…' : mode === 'create' ? 'Crear producto' : 'Guardar cambios'}
          </Button>
        </FormActions>
      </form>
    </div>
  )
}
