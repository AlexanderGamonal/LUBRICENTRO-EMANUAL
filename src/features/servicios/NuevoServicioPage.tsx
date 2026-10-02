import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CalendarDays, Phone, Trash2, User } from 'lucide-react'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { fechaLargaLima, formatCurrency, formatDate } from '@/shared/utils/formatters'
import { Button, Field, FormActions, PageHeader, RadioCardGroup, SearchCombobox } from '@/shared/ui'
import { MEDIO_PAGO_OPTIONS } from '@/features/ventas/pos/constants'
import type { Database, MedioPago } from '@/shared/types/database'

type ProductoDetalle = Database['public']['Views']['vw_productos_detalle']['Row']
type VehiculoRow = Database['public']['Tables']['vehiculos']['Row']
type ClienteRow = Database['public']['Tables']['clientes']['Row']

type VehiculoConCliente = VehiculoRow & {
  clientes: Pick<ClienteRow, 'id' | 'nombre' | 'telefono'> | null
}

type CartItem = {
  producto_id: string
  nombre: string
  cantidad: number
  precio_unitario: number
}

type UltimoServicio = {
  fecha_servicio: string
  kilometraje: number | null
}

// La fecha no se edita: el servidor siempre registra "hoy" (hora de Lima).
const servicioSchema = z.object({
  kilometraje: z
    .number({ invalid_type_error: 'Ingresa un número' })
    .int('Debe ser un número entero')
    .min(0, 'No puede ser negativo')
    .optional()
    .nullable(),
  descripcion: z.string().min(3, 'Describe el servicio realizado'),
  observaciones: z.string().optional(),
})

type ServicioFormValues = z.infer<typeof servicioSchema>

const etiquetaVehiculo = (v: Pick<VehiculoRow, 'marca_vehiculo' | 'modelo' | 'anio'>) =>
  [v.marca_vehiculo, v.modelo, v.anio].filter(Boolean).join(' ')

export default function NuevoServicioPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()

  const vehiculoIdFromUrl = searchParams.get('vehiculo_id')

  const [vehiculoSeleccionado, setVehiculoSeleccionado] = useState<VehiculoConCliente | null>(null)
  const [placaSearch, setPlacaSearch] = useState('')
  const debouncedPlaca = useDebounce(placaSearch, 300)
  const placaInputRef = useRef<HTMLInputElement>(null)

  const [productoSearch, setProductoSearch] = useState('')
  const debouncedProducto = useDebounce(productoSearch, 300)

  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [montoServicio, setMontoServicio] = useState<number>(0)
  const [medioPago, setMedioPago] = useState<MedioPago>('efectivo')
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<ServicioFormValues>({
    resolver: zodResolver(servicioSchema),
    defaultValues: { kilometraje: null, descripcion: '', observaciones: '' },
    mode: 'onChange',
  })

  // Vehículo recibido por URL (?vehiculo_id=…)
  const { data: vehiculoFromUrl, isLoading: loadingVehiculoUrl } = useQuery({
    queryKey: ['vehiculo-url', vehiculoIdFromUrl, user?.sucursal_id],
    queryFn: async () => {
      if (!vehiculoIdFromUrl || !user?.sucursal_id) return null
      const { data, error } = await supabase
        .from('vehiculos')
        .select('*, clientes(id, nombre, telefono)')
        .eq('id', vehiculoIdFromUrl)
        .eq('sucursal_id', user.sucursal_id)
        .eq('activo', true)
        .single()
      if (error || !data) return null
      return data as unknown as VehiculoConCliente
    },
    enabled: !!vehiculoIdFromUrl && !!user?.sucursal_id,
  })

  useEffect(() => {
    if (vehiculoFromUrl && !vehiculoSeleccionado) setVehiculoSeleccionado(vehiculoFromUrl)
  }, [vehiculoFromUrl, vehiculoSeleccionado])

  // Búsqueda de vehículo por placa
  const { data: vehiculosEncontrados = [], isFetching: buscandoVehiculo } = useQuery({
    queryKey: ['vehiculos-search', debouncedPlaca, user?.sucursal_id],
    queryFn: async () => {
      if (!debouncedPlaca.trim() || !user?.sucursal_id) return []
      const { data, error } = await supabase
        .from('vehiculos')
        .select('*, clientes(id, nombre, telefono)')
        .eq('sucursal_id', user.sucursal_id)
        .ilike('placa', `%${debouncedPlaca.trim()}%`)
        .eq('activo', true)
        .limit(5)
      if (error) return []
      return (data ?? []) as unknown as VehiculoConCliente[]
    },
    enabled: !!debouncedPlaca.trim() && !vehiculoIdFromUrl && !!user?.sucursal_id,
  })

  // Última atención del vehículo
  const { data: ultimoServicio } = useQuery({
    queryKey: ['ultimo-servicio', vehiculoSeleccionado?.id],
    queryFn: async () => {
      if (!vehiculoSeleccionado?.id) return null
      const { data, error } = await supabase
        .from('servicios')
        .select('fecha_servicio, kilometraje')
        .eq('vehiculo_id', vehiculoSeleccionado.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error || !data) return null
      return data as UltimoServicio
    },
    enabled: !!vehiculoSeleccionado?.id,
  })

  // Búsqueda de productos
  const { data: productosEncontrados = [], isFetching: buscandoProducto } = useQuery({
    queryKey: ['productos-search', debouncedProducto, user?.sucursal_id],
    queryFn: async () => {
      if (!debouncedProducto.trim() || !user?.sucursal_id) return []
      const term = debouncedProducto.trim()
      const { data, error } = await supabase
        .from('vw_productos_detalle')
        .select('*')
        .eq('sucursal_id', user.sucursal_id)
        .eq('activo', true)
        .or(`nombre.ilike.%${term}%,codigo_interno.ilike.%${term}%`)
        .limit(10)
      if (error) return []
      return (data ?? []) as ProductoDetalle[]
    },
    enabled: !!debouncedProducto.trim() && !!user?.sucursal_id,
  })

  function handleSelectVehiculo(v: VehiculoConCliente) {
    setVehiculoSeleccionado(v)
    setPlacaSearch('')
  }

  function handleClearVehiculo() {
    setVehiculoSeleccionado(null)
    setPlacaSearch('')
    setTimeout(() => placaInputRef.current?.focus(), 50)
  }

  function handleAddProducto(p: ProductoDetalle) {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.producto_id === p.id)
      if (existing) return prev.map((item) => (item.producto_id === p.id ? { ...item, cantidad: item.cantidad + 1 } : item))
      return [...prev, { producto_id: p.id, nombre: p.nombre, cantidad: 1, precio_unitario: p.precio_venta }]
    })
    setProductoSearch('')
  }

  function handleRemoveCartItem(producto_id: string) {
    setCartItems((prev) => prev.filter((i) => i.producto_id !== producto_id))
  }

  function handleCartQtyChange(producto_id: string, qty: number) {
    if (qty < 1) return
    setCartItems((prev) => prev.map((i) => (i.producto_id === producto_id ? { ...i, cantidad: qty } : i)))
  }

  function handleCartPriceChange(producto_id: string, precio: number) {
    if (precio < 0) return
    setCartItems((prev) => prev.map((i) => (i.producto_id === producto_id ? { ...i, precio_unitario: precio } : i)))
  }

  const cartTotal = cartItems.reduce((sum, item) => sum + item.cantidad * item.precio_unitario, 0)
  const totalFinal = cartTotal + montoServicio

  const clienteId = vehiculoSeleccionado?.cliente_id ?? null
  const creditoSinCliente = medioPago === 'credito' && !clienteId

  const onSubmit = handleSubmit(async (values) => {
    if (!vehiculoSeleccionado || !user || creditoSinCliente) return
    setSubmitting(true)
    try {
      const items = cartItems.map((item) => ({
        producto_id: item.producto_id,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
      }))

      const { error } = await supabase.rpc('registrar_servicio', {
        p_vehiculo_id: vehiculoSeleccionado.id,
        p_descripcion: values.descripcion,
        p_items: items,
        p_kilometraje: values.kilometraje ?? null,
        p_observaciones: values.observaciones || null,
        p_cliente_id: clienteId,
        p_monto_servicio: montoServicio,
        p_medio_pago: medioPago,
      })

      if (error) throw error

      toast.success('Atención registrada correctamente')
      navigate(`/vehiculos/${vehiculoSeleccionado.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al registrar la atención')
    } finally {
      setSubmitting(false)
    }
  })

  const canSubmit = !!vehiculoSeleccionado && isValid && !submitting && !creditoSinCliente

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <PageHeader back title="Nueva atención" description="Registra el servicio realizado, los productos usados y el cobro." />

      <form onSubmit={onSubmit} noValidate>
        <div className="space-y-5 lg:grid lg:grid-cols-[1fr_380px] lg:gap-5 lg:space-y-0">
          {/* ─── Columna izquierda ─── */}
          <div className="space-y-5">
            <section className="card space-y-4 p-4 sm:p-5" aria-labelledby="sec-vehiculo">
              <h2 id="sec-vehiculo" className="text-base font-semibold text-primary-700">
                Vehículo
              </h2>

              {loadingVehiculoUrl && (
                <p role="status" className="text-sm text-fg-muted">
                  Cargando vehículo…
                </p>
              )}

              {!vehiculoSeleccionado && !vehiculoIdFromUrl && (
                <>
                  <SearchCombobox<VehiculoConCliente>
                    label="Placa del vehículo"
                    placeholder="Ingresa la placa"
                    query={placaSearch}
                    onQueryChange={(v) => setPlacaSearch(v.toUpperCase().trim())}
                    items={vehiculosEncontrados}
                    loading={buscandoVehiculo}
                    getKey={(v) => v.id}
                    onSelect={handleSelectVehiculo}
                    inputRef={placaInputRef}
                    inputClassName="font-mono text-xl uppercase tracking-wider"
                    inputProps={{ maxLength: 8, autoFocus: true, autoCapitalize: 'characters' }}
                    emptyMessage={
                      <>
                        No encontrado —{' '}
                        <Link to="/vehiculos/nuevo" className="font-medium text-primary-700 hover:underline">
                          registrar nuevo vehículo
                        </Link>
                      </>
                    }
                    renderItem={(v) => (
                      <div className="flex items-center gap-3">
                        <span className="shrink-0 rounded bg-primary-700 px-2 py-0.5 font-mono text-sm text-white">{v.placa}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-fg">{etiquetaVehiculo(v) || 'Sin datos'}</p>
                          {v.clientes && <p className="text-xs text-fg-muted">{v.clientes.nombre}</p>}
                        </div>
                      </div>
                    )}
                  />
                </>
              )}

              {vehiculoSeleccionado && (
                <div className="space-y-3 rounded-lg border border-blue-100 bg-blue-50 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="inline-block rounded bg-primary-700 px-3 py-1 font-mono text-lg text-white">{vehiculoSeleccionado.placa}</span>
                      <p className="mt-1 text-sm text-fg-muted">
                        {etiquetaVehiculo(vehiculoSeleccionado)}
                        {vehiculoSeleccionado.color && <span className="text-fg-subtle"> · {vehiculoSeleccionado.color}</span>}
                      </p>
                    </div>
                    {!vehiculoIdFromUrl && (
                      <button
                        type="button"
                        onClick={handleClearVehiculo}
                        className="inline-flex min-h-touch shrink-0 items-center rounded-lg px-2 text-sm font-medium text-fg-muted transition-colors hover:text-fg md:min-h-0"
                      >
                        Cambiar vehículo
                      </button>
                    )}
                  </div>

                  {vehiculoSeleccionado.clientes ? (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-blue-100 pt-3 text-sm text-fg-muted">
                      <span className="flex items-center gap-1.5">
                        <User className="h-4 w-4 text-fg-subtle" aria-hidden="true" />
                        {vehiculoSeleccionado.clientes.nombre}
                      </span>
                      {vehiculoSeleccionado.clientes.telefono && (
                        <span className="flex items-center gap-1.5">
                          <Phone className="h-4 w-4 text-fg-subtle" aria-hidden="true" />
                          {vehiculoSeleccionado.clientes.telefono}
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="border-t border-blue-100 pt-3 text-sm text-fg-muted">Este vehículo no tiene cliente asociado.</p>
                  )}

                  <p className="border-t border-blue-100 pt-2 text-xs text-fg-muted">
                    {ultimoServicio ? (
                      <>
                        Última atención: <span className="font-medium text-fg">{formatDate(ultimoServicio.fecha_servicio)}</span>
                        {ultimoServicio.kilometraje != null && (
                          <>
                            {' '}
                            — <span className="font-medium text-fg">{ultimoServicio.kilometraje.toLocaleString('es-PE')} km</span>
                          </>
                        )}
                      </>
                    ) : (
                      'Sin atenciones previas'
                    )}
                  </p>
                </div>
              )}
            </section>

            {vehiculoSeleccionado && (
              <section className="card space-y-4 p-4 sm:p-5" aria-labelledby="sec-detalle">
                <h2 id="sec-detalle" className="text-base font-semibold text-primary-700">
                  Detalles del servicio
                </h2>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <p className="label-text">Fecha del servicio</p>
                    <p className="flex min-h-[40px] items-center gap-2 rounded-lg border border-line bg-muted px-3 text-sm text-fg-muted">
                      <CalendarDays className="h-4 w-4 text-fg-subtle" aria-hidden="true" />
                      Hoy, <span className="first-letter:uppercase">{fechaLargaLima()}</span>
                    </p>
                  </div>

                  <Field label="Kilometraje" error={errors.kilometraje?.message}>
                    {(p) => (
                      <input
                        {...p}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        placeholder="85000"
                        className="input-field"
                        {...register('kilometraje', { setValueAs: (v) => (v === '' || v === null ? null : Number(v)) })}
                      />
                    )}
                  </Field>
                </div>

                <Field label="Descripción del servicio" required error={errors.descripcion?.message}>
                  {(p) => (
                    <textarea {...p} rows={2} placeholder="Cambio de aceite 15W40, filtro de aceite..." className="input-field resize-none" {...register('descripcion')} />
                  )}
                </Field>

                <Field label="Observaciones">
                  {(p) => <textarea {...p} rows={2} placeholder="Notas adicionales..." className="input-field resize-none" {...register('observaciones')} />}
                </Field>
              </section>
            )}
          </div>

          {/* ─── Columna derecha: productos, cobro y total ─── */}
          <div className="space-y-5">
            <section className="card space-y-4 p-4 sm:p-5" aria-labelledby="sec-productos">
              <h2 id="sec-productos" className="text-base font-semibold text-primary-700">
                Productos utilizados
              </h2>

              <SearchCombobox<ProductoDetalle>
                label="Buscar producto"
                hideLabel
                placeholder="Buscar producto por nombre o código..."
                query={productoSearch}
                onQueryChange={setProductoSearch}
                items={productosEncontrados}
                loading={buscandoProducto}
                getKey={(p) => p.id}
                onSelect={handleAddProducto}
                minChars={2}
                emptyMessage={`Sin resultados para «${debouncedProducto}»`}
                renderItem={(p) => (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-fg">{p.nombre}</p>
                      <p className="text-xs text-fg-muted">
                        {p.codigo_interno} · Stock: {p.stock_actual}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-primary-700">{formatCurrency(p.precio_venta)}</span>
                  </div>
                )}
              />

              {cartItems.length === 0 ? (
                <p className="rounded-lg border-2 border-dashed border-line py-6 text-center text-sm text-fg-subtle">Sin productos — busca y agrega arriba</p>
              ) : (
                <ul className="space-y-2" aria-label="Productos agregados">
                  {cartItems.map((item) => (
                    <li key={item.producto_id} className="flex items-start gap-2 rounded-lg border border-line bg-muted p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-fg">{item.nombre}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                          <label className="flex items-center gap-1 text-xs text-fg-muted">
                            Cant.
                            <input
                              type="number"
                              inputMode="numeric"
                              min={1}
                              value={item.cantidad}
                              onChange={(e) => handleCartQtyChange(item.producto_id, Number(e.target.value))}
                              className="h-[34px] w-14 rounded border border-line bg-card px-1 text-center text-sm text-fg focus:outline-none focus:ring-1 focus:ring-primary-700 [@media(pointer:coarse)]:h-[44px]"
                            />
                          </label>
                          <label className="flex items-center gap-1 text-xs text-fg-muted">
                            S/
                            <input
                              type="number"
                              inputMode="decimal"
                              min={0}
                              step={0.01}
                              value={item.precio_unitario}
                              onChange={(e) => handleCartPriceChange(item.producto_id, Number(e.target.value))}
                              className="h-[34px] w-20 rounded border border-line bg-card px-1 text-center text-sm text-fg focus:outline-none focus:ring-1 focus:ring-primary-700 [@media(pointer:coarse)]:h-[44px]"
                            />
                          </label>
                          <span className="ml-auto text-sm font-medium text-fg-muted">= {formatCurrency(item.cantidad * item.precio_unitario)}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveCartItem(item.producto_id)}
                        aria-label={`Quitar ${item.nombre}`}
                        className="-mr-1 flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg text-fg-subtle transition-colors hover:text-red-600 [@media(pointer:coarse)]:h-[44px] [@media(pointer:coarse)]:w-[44px]"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="border-t border-line pt-4">
                <Field label="Mano de obra / servicio (S/)" hint="Se suma al precio de los productos">
                  {(p) => (
                    <input
                      {...p}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={0.5}
                      value={montoServicio || ''}
                      onChange={(e) => setMontoServicio(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="input-field"
                      placeholder="0.00"
                    />
                  )}
                </Field>
              </div>
            </section>

            {vehiculoSeleccionado && (
              <section className="card space-y-4 p-4 sm:p-5" aria-labelledby="sec-cobro">
                <h2 id="sec-cobro" className="text-base font-semibold text-primary-700">
                  Cobro
                </h2>
                <RadioCardGroup
                  layout="grid"
                  legend="Medio de pago"
                  value={medioPago}
                  onChange={setMedioPago}
                  options={MEDIO_PAGO_OPTIONS.map((o) => ({ value: o.value, label: o.label, icon: o.icon }))}
                />
                {creditoSinCliente && (
                  <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                    Un servicio a crédito necesita un cliente. Asocia uno al vehículo o elige otro medio de pago.
                  </p>
                )}

                <dl className="space-y-1 border-t border-line pt-4">
                  {montoServicio > 0 && (
                    <div className="flex items-center justify-between text-xs text-fg-muted">
                      <dt>Productos</dt>
                      <dd>{formatCurrency(cartTotal)}</dd>
                    </div>
                  )}
                  {montoServicio > 0 && (
                    <div className="flex items-center justify-between text-xs text-fg-muted">
                      <dt>Mano de obra</dt>
                      <dd>{formatCurrency(montoServicio)}</dd>
                    </div>
                  )}
                  <div className="flex items-baseline justify-between">
                    <dt className="text-sm font-semibold text-fg-muted">Total a cobrar</dt>
                    <dd className="font-display text-2xl font-bold tabular-nums text-primary-700">{formatCurrency(totalFinal)}</dd>
                  </div>
                </dl>
              </section>
            )}
          </div>
        </div>

        <FormActions align="end" className="lg:mt-5">
          <div className="!flex-none self-center text-left md:hidden" aria-hidden="true">
            <p className="text-xs text-fg-muted">Total</p>
            <p className="font-display text-lg font-bold leading-tight text-primary-700">{formatCurrency(totalFinal)}</p>
          </div>
          <Button type="submit" size="lg" loading={submitting} disabled={!canSubmit} className="sm:min-w-[220px]">
            {submitting ? 'Registrando…' : 'Registrar atención'}
          </Button>
        </FormActions>
        {!vehiculoSeleccionado && <p className="mt-2 text-center text-sm text-fg-subtle">Selecciona un vehículo para continuar</p>}
      </form>
    </div>
  )
}
