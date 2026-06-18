import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { formatCurrency, formatDate } from '@/shared/utils/formatters'
import { cn } from '@/shared/utils/cn'
import type { Database } from '@/shared/types/database'

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

const servicioSchema = z.object({
  fecha_servicio: z.string().min(1, 'Requerido'),
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

function SpinnerIcon() {
  return (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}

export default function NuevoServicioPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()

  const vehiculoIdFromUrl = searchParams.get('vehiculo_id')

  // Vehicle selection state
  const [vehiculoSeleccionado, setVehiculoSeleccionado] = useState<VehiculoConCliente | null>(null)
  const [placaSearch, setPlacaSearch] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const debouncedPlaca = useDebounce(placaSearch, 300)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Product search state
  const [productoSearch, setProductoSearch] = useState('')
  const debouncedProducto = useDebounce(productoSearch, 300)
  const [productDropdownOpen, setProductDropdownOpen] = useState(false)
  const productDropdownRef = useRef<HTMLDivElement>(null)

  // Cart
  const [cartItems, setCartItems] = useState<CartItem[]>([])

  // Submitting
  const [submitting, setSubmitting] = useState(false)

  // React Hook Form
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<ServicioFormValues>({
    resolver: zodResolver(servicioSchema),
    defaultValues: {
      fecha_servicio: new Date().toISOString().split('T')[0],
      kilometraje: null,
      descripcion: '',
      observaciones: '',
    },
    mode: 'onChange',
  })

  // Load vehicle from URL param
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
    if (vehiculoFromUrl && !vehiculoSeleccionado) {
      setVehiculoSeleccionado(vehiculoFromUrl)
    }
  }, [vehiculoFromUrl, vehiculoSeleccionado])

  // Vehicle search query (only when no URL param)
  const { data: vehiculosEncontrados } = useQuery({
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

  // Last service for selected vehicle
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

  // Product search query
  const { data: productosEncontrados } = useQuery({
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

  // Close vehicle dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Close product dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        productDropdownRef.current &&
        !productDropdownRef.current.contains(e.target as Node)
      ) {
        setProductDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Show dropdown when results arrive
  useEffect(() => {
    if (vehiculosEncontrados && vehiculosEncontrados.length > 0) {
      setDropdownOpen(true)
    }
  }, [vehiculosEncontrados])

  useEffect(() => {
    if (productosEncontrados && productosEncontrados.length > 0 && debouncedProducto.trim()) {
      setProductDropdownOpen(true)
    }
  }, [productosEncontrados, debouncedProducto])

  function handleSelectVehiculo(v: VehiculoConCliente) {
    setVehiculoSeleccionado(v)
    setPlacaSearch('')
    setDropdownOpen(false)
  }

  function handleClearVehiculo() {
    setVehiculoSeleccionado(null)
    setPlacaSearch('')
    setTimeout(() => searchInputRef.current?.focus(), 50)
  }

  function handleAddProducto(p: ProductoDetalle) {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.producto_id === p.id)
      if (existing) {
        return prev.map((item) =>
          item.producto_id === p.id
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        )
      }
      return [
        ...prev,
        {
          producto_id: p.id,
          nombre: p.nombre,
          cantidad: 1,
          precio_unitario: p.precio_venta,
        },
      ]
    })
    setProductoSearch('')
    setProductDropdownOpen(false)
  }

  function handleRemoveCartItem(producto_id: string) {
    setCartItems((prev) => prev.filter((i) => i.producto_id !== producto_id))
  }

  function handleCartQtyChange(producto_id: string, qty: number) {
    if (qty < 1) return
    setCartItems((prev) =>
      prev.map((i) => (i.producto_id === producto_id ? { ...i, cantidad: qty } : i))
    )
  }

  function handleCartPriceChange(producto_id: string, precio: number) {
    if (precio < 0) return
    setCartItems((prev) =>
      prev.map((i) =>
        i.producto_id === producto_id ? { ...i, precio_unitario: precio } : i
      )
    )
  }

  const [montoServicio, setMontoServicio] = useState<number>(0)

  const cartTotal = cartItems.reduce(
    (sum, item) => sum + item.cantidad * item.precio_unitario,
    0
  )
  const totalFinal = cartTotal + montoServicio

  const onSubmit = handleSubmit(async (values) => {
    if (!vehiculoSeleccionado || !user) return
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
        p_cliente_id: vehiculoSeleccionado.cliente_id ?? null,
        p_monto_servicio: montoServicio,
      })

      if (error) throw error

      toast.success('Atención registrada correctamente')
      navigate(`/vehiculos/${vehiculoSeleccionado.id}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al registrar la atención'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  })

  const canSubmit = !!vehiculoSeleccionado && isValid && !submitting

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-10">
      {/* Top bar */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Volver
        </button>
        <h1 className="text-2xl font-bold text-[#1F3864]">Nueva atención</h1>
      </div>

      <form onSubmit={onSubmit} noValidate>
        <div className="lg:grid lg:grid-cols-[1fr_380px] lg:gap-5 space-y-5 lg:space-y-0">

          {/* ─── LEFT COLUMN ─── */}
          <div className="space-y-5">

            {/* Section A: Vehicle selection */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
              <h2 className="text-base font-semibold text-[#1F3864]">Vehículo</h2>

              {loadingVehiculoUrl && (
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <SpinnerIcon />
                  Cargando vehículo…
                </div>
              )}

              {!vehiculoSeleccionado && !vehiculoIdFromUrl && (
                <div ref={dropdownRef} className="relative">
                  <input
                    ref={searchInputRef}
                    autoFocus
                    type="text"
                    className="input-field font-mono text-xl uppercase tracking-wider"
                    placeholder="Ingresa la placa del vehículo"
                    value={placaSearch}
                    maxLength={8}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase().trim()
                      setPlacaSearch(val)
                      if (!val) setDropdownOpen(false)
                    }}
                  />

                  {dropdownOpen && vehiculosEncontrados && vehiculosEncontrados.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                      {vehiculosEncontrados.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => handleSelectVehiculo(v)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 text-left border-b border-gray-50 last:border-0 transition-colors"
                        >
                          <span className="bg-[#1F3864] text-white text-sm font-mono px-2 py-0.5 rounded shrink-0">
                            {v.placa}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800">
                              {[v.marca_vehiculo, v.modelo, v.anio].filter(Boolean).join(' ')}
                            </p>
                            {v.clientes && (
                              <p className="text-xs text-gray-500">{v.clientes.nombre}</p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {dropdownOpen === false &&
                    debouncedPlaca.trim().length >= 2 &&
                    vehiculosEncontrados &&
                    vehiculosEncontrados.length === 0 && (
                      <div className="mt-2 text-sm text-gray-500">
                        No encontrado —{' '}
                        <Link
                          to="/vehiculos/nuevo"
                          className="text-[#1F3864] hover:underline font-medium"
                        >
                          Registrar nuevo vehículo
                        </Link>
                      </div>
                    )}
                </div>
              )}

              {/* Vehicle Info Card */}
              {vehiculoSeleccionado && (
                <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <span className="bg-[#1F3864] text-white font-mono text-lg px-3 py-1 rounded inline-block">
                        {vehiculoSeleccionado.placa}
                      </span>
                      <div className="text-sm text-gray-700 mt-1">
                        {[
                          vehiculoSeleccionado.marca_vehiculo,
                          vehiculoSeleccionado.modelo,
                          vehiculoSeleccionado.anio,
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        {vehiculoSeleccionado.color && (
                          <span className="text-gray-500"> · {vehiculoSeleccionado.color}</span>
                        )}
                      </div>
                    </div>

                    {!vehiculoIdFromUrl && (
                      <button
                        type="button"
                        onClick={handleClearVehiculo}
                        className="text-sm text-gray-400 hover:text-gray-600 transition-colors shrink-0 ml-2"
                      >
                        Cambiar vehículo
                      </button>
                    )}
                  </div>

                  {vehiculoSeleccionado.clientes && (
                    <div className="flex flex-wrap gap-4 text-sm text-gray-700 border-t border-blue-100 pt-3">
                      <div className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span>{vehiculoSeleccionado.clientes.nombre}</span>
                      </div>
                      {vehiculoSeleccionado.clientes.telefono && (
                        <div className="flex items-center gap-1.5">
                          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          <span>{vehiculoSeleccionado.clientes.telefono}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="text-xs text-gray-500 border-t border-blue-100 pt-2">
                    {ultimoServicio ? (
                      <>
                        Última atención:{' '}
                        <span className="font-medium text-gray-700">
                          {formatDate(ultimoServicio.fecha_servicio)}
                        </span>
                        {ultimoServicio.kilometraje != null && (
                          <>
                            {' '}— {' '}
                            <span className="font-medium text-gray-700">
                              {ultimoServicio.kilometraje.toLocaleString('es-PE')} km
                            </span>
                          </>
                        )}
                      </>
                    ) : (
                      'Sin atenciones previas'
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Section B: Service Details */}
            {vehiculoSeleccionado && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
                <h2 className="text-base font-semibold text-[#1F3864]">Detalles del servicio</h2>

                <div className="grid grid-cols-2 gap-4">
                  {/* Date */}
                  <div>
                    <label className="label-text">Fecha del servicio</label>
                    <input
                      type="date"
                      className={cn('input-field', errors.fecha_servicio && 'border-red-400')}
                      {...register('fecha_servicio')}
                    />
                    {errors.fecha_servicio && (
                      <p className="error-text">{errors.fecha_servicio.message}</p>
                    )}
                  </div>

                  {/* Kilometraje */}
                  <div>
                    <label className="label-text">Kilometraje</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      placeholder="85000"
                      className={cn('input-field', errors.kilometraje && 'border-red-400')}
                      {...register('kilometraje', {
                        setValueAs: (v) => (v === '' || v === null ? null : Number(v)),
                      })}
                    />
                    {errors.kilometraje && (
                      <p className="error-text">{errors.kilometraje.message}</p>
                    )}
                  </div>
                </div>

                {/* Descripción */}
                <div>
                  <label className="label-text">Descripción del servicio *</label>
                  <textarea
                    rows={2}
                    placeholder="Cambio de aceite 15W40, filtro de aceite..."
                    className={cn('input-field resize-none', errors.descripcion && 'border-red-400')}
                    {...register('descripcion')}
                  />
                  {errors.descripcion && (
                    <p className="error-text">{errors.descripcion.message}</p>
                  )}
                </div>

                {/* Observaciones */}
                <div>
                  <label className="label-text">Observaciones</label>
                  <textarea
                    rows={2}
                    placeholder="Notas adicionales..."
                    className="input-field resize-none"
                    {...register('observaciones')}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ─── RIGHT COLUMN: Products Cart ─── */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
              <h2 className="text-base font-semibold text-[#1F3864]">Productos utilizados</h2>

              {/* Product search */}
              <div ref={productDropdownRef} className="relative">
                <input
                  type="text"
                  className="input-field text-sm"
                  placeholder="Buscar producto por nombre o código..."
                  value={productoSearch}
                  onChange={(e) => {
                    setProductoSearch(e.target.value)
                    if (!e.target.value.trim()) setProductDropdownOpen(false)
                  }}
                  onFocus={() => {
                    if (productosEncontrados && productosEncontrados.length > 0 && productoSearch.trim()) {
                      setProductDropdownOpen(true)
                    }
                  }}
                />

                {productDropdownOpen && productosEncontrados && productosEncontrados.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-64 overflow-y-auto">
                    {productosEncontrados.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleAddProducto(p)}
                        className="w-full flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-blue-50 text-left border-b border-gray-50 last:border-0 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{p.nombre}</p>
                          <p className="text-xs text-gray-500">
                            {p.codigo_interno} · Stock: {p.stock_actual}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-[#1F3864] shrink-0">
                          {formatCurrency(p.precio_venta)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {debouncedProducto.trim().length >= 2 &&
                  productosEncontrados &&
                  productosEncontrados.length === 0 && (
                    <p className="mt-1 text-xs text-gray-400">Sin resultados para "{debouncedProducto}"</p>
                  )}
              </div>

              {/* Cart items */}
              {cartItems.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-sm border-2 border-dashed border-gray-100 rounded-lg">
                  Sin productos — busca y agrega arriba
                </div>
              ) : (
                <div className="space-y-2">
                  {cartItems.map((item) => (
                    <div
                      key={item.producto_id}
                      className="flex items-start gap-2 p-3 rounded-lg border border-gray-100 bg-gray-50"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{item.nombre}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          {/* Cantidad */}
                          <div className="flex items-center gap-1">
                            <label className="text-xs text-gray-500">Cant.</label>
                            <input
                              type="number"
                              min={1}
                              value={item.cantidad}
                              onChange={(e) =>
                                handleCartQtyChange(item.producto_id, Number(e.target.value))
                              }
                              className="w-14 text-xs text-center border border-gray-200 rounded px-1 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-[#1F3864]"
                            />
                          </div>

                          {/* Precio */}
                          <div className="flex items-center gap-1">
                            <label className="text-xs text-gray-500">S/</label>
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={item.precio_unitario}
                              onChange={(e) =>
                                handleCartPriceChange(item.producto_id, Number(e.target.value))
                              }
                              className="w-20 text-xs text-center border border-gray-200 rounded px-1 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-[#1F3864]"
                            />
                          </div>

                          {/* Subtotal */}
                          <span className="text-xs text-gray-600 ml-auto">
                            = {formatCurrency(item.cantidad * item.precio_unitario)}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveCartItem(item.producto_id)}
                        className="text-gray-300 hover:text-red-500 transition-colors shrink-0 mt-0.5"
                        title="Eliminar"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Mano de obra / cobro por servicio */}
              <div className="border-t border-gray-100 pt-3">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-gray-600">Mano de obra / servicio</label>
                  <span className="text-xs text-gray-400">adicional a productos</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 font-medium">S/</span>
                  <input
                    type="number"
                    min={0}
                    step={0.50}
                    value={montoServicio}
                    onChange={(e) => setMontoServicio(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="input-field py-1.5 text-sm flex-1"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Total */}
              <div className="border-t border-gray-100 pt-3 space-y-1">
                {montoServicio > 0 && (
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>Productos</span>
                    <span>{formatCurrency(cartTotal)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 font-semibold">Total a cobrar</span>
                  <span className="text-2xl font-bold text-[#1F3864]">
                    {formatCurrency(totalFinal)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Submit button — full width below both columns */}
        <div className="mt-5">
          <button
            type="submit"
            disabled={!canSubmit}
            className={cn(
              'w-full py-3 rounded-xl text-white font-semibold text-base flex items-center justify-center gap-2 transition-opacity shadow-sm',
              canSubmit ? 'hover:opacity-90' : 'opacity-50 cursor-not-allowed'
            )}
            style={{ background: 'linear-gradient(135deg, #1F3864, #0ea5e9)' }}
          >
            {submitting ? (
              <>
                <SpinnerIcon />
                Registrando…
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Registrar atención
              </>
            )}
          </button>

          {!vehiculoSeleccionado && (
            <p className="text-center text-sm text-gray-400 mt-2">
              Selecciona un vehículo para continuar
            </p>
          )}
        </div>
      </form>
    </div>
  )
}
