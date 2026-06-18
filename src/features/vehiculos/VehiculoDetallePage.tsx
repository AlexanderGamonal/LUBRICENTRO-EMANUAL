import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { formatCurrency, formatDate } from '@/shared/utils/formatters'
import type { Database } from '@/shared/types/database'

type ServicioRow = Database['public']['Tables']['servicios']['Row']
type MantenimientoRow = Database['public']['Tables']['mantenimientos_recomendados']['Row']
type EstadoServicio = 'pendiente' | 'terminado' | 'anulado'

type VehiculoConCliente = Database['public']['Tables']['vehiculos']['Row'] & {
  clientes: { id: string; nombre: string; telefono: string | null } | null
}

const ESTADO_CONFIG: Record<EstadoServicio, { label: string; bg: string; text: string }> = {
  terminado: { label: 'Terminado', bg: 'bg-green-100', text: 'text-green-700' },
  pendiente:  { label: 'Pendiente', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  anulado:    { label: 'Anulado',   bg: 'bg-red-100',    text: 'text-red-600'   },
}

const TIPO_LABEL: Record<string, string> = {
  cambio_aceite:      'Cambio aceite',
  filtro_aceite:      'Filtro aceite',
  filtro_aire:        'Filtro aire',
  filtro_combustible: 'Filtro combustible',
  refrigerante:       'Refrigerante',
  aceite_caja:        'Aceite caja',
  aceite_diferencial: 'Aceite diferencial',
  liquido_frenos:     'Líquido frenos',
}

export default function VehiculoDetallePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: vehiculo, isLoading: loadingVehiculo } = useQuery<VehiculoConCliente | null>({
    queryKey: ['vehiculo-detalle', id],
    queryFn: async () => {
      if (!id) return null
      const { data, error } = await supabase
        .from('vehiculos')
        .select('*, clientes(id, nombre, telefono)')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as unknown as VehiculoConCliente
    },
    enabled: !!id,
  })

  const { data: servicios = [], isLoading: loadingServicios } = useQuery<ServicioRow[]>({
    queryKey: ['servicios-vehiculo', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('servicios')
        .select('id, fecha_servicio, kilometraje, descripcion, observaciones, estado, total, created_at')
        .eq('vehiculo_id', id!)
        .order('fecha_servicio', { ascending: false })
        .limit(50)
      if (error) throw error
      return (data ?? []) as ServicioRow[]
    },
    enabled: !!id,
  })

  const { data: mantenimientos = [] } = useQuery<MantenimientoRow[]>({
    queryKey: ['mantenimientos', vehiculo?.marca_vehiculo],
    queryFn: async () => {
      if (!vehiculo?.marca_vehiculo) return []
      const { data, error } = await supabase
        .from('mantenimientos_recomendados')
        .select('*')
        .or(`marca_vehiculo.eq.${vehiculo.marca_vehiculo},marca_vehiculo.eq.General`)
        .order('tipo_servicio')
      if (error) throw error
      // deduplicate by tipo_servicio (prefer marca-specific over General)
      const seen = new Map<string, MantenimientoRow>()
      for (const m of (data ?? []) as MantenimientoRow[]) {
        if (!seen.has(m.tipo_servicio) || m.marca_vehiculo !== 'General') {
          seen.set(m.tipo_servicio, m)
        }
      }
      return Array.from(seen.values())
    },
    enabled: !!vehiculo?.marca_vehiculo,
  })

  const ultimoServicio = servicios[0]
  const ultimoKm = ultimoServicio?.kilometraje ?? null

  if (loadingVehiculo) {
    return (
      <div className="animate-fade-in p-6 max-w-4xl mx-auto space-y-4">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="card p-6">
          <div className="h-32 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="card p-6">
          <div className="h-40 bg-gray-100 rounded animate-pulse" />
        </div>
      </div>
    )
  }

  if (!vehiculo) {
    return (
      <div className="animate-fade-in p-6 max-w-4xl mx-auto text-center py-20">
        <p className="text-gray-500 text-lg mb-4">Vehículo no encontrado</p>
        <button onClick={() => navigate('/vehiculos')} className="btn-secondary">
          Volver a Vehículos
        </button>
      </div>
    )
  }

  const cliente = vehiculo.clientes

  return (
    <div className="animate-fade-in p-6 max-w-4xl mx-auto">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-[#1F3864] mb-5 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Volver
      </button>

      {/* Vehicle header card */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          {/* Placa + info */}
          <div className="flex-1">
            <span className="inline-block font-mono text-2xl font-bold text-white px-4 py-2 rounded-lg mb-3"
              style={{ background: 'linear-gradient(135deg, #1F3864, #0ea5e9)' }}>
              {vehiculo.placa}
            </span>
            <div className="space-y-0.5">
              <p className="text-lg font-semibold text-gray-800">
                {[vehiculo.marca_vehiculo, vehiculo.modelo, vehiculo.anio].filter(Boolean).join(' ') || 'Datos no especificados'}
              </p>
              {vehiculo.color && (
                <p className="text-sm text-gray-500 flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full border border-gray-300 inline-block flex-shrink-0"
                    style={{ background: vehiculo.color.toLowerCase() }} />
                  {vehiculo.color}
                </p>
              )}
              {ultimoServicio && (
                <p className="text-sm text-gray-500 mt-1">
                  Última atención: <span className="font-medium text-gray-700">{formatDate(ultimoServicio.fecha_servicio)}</span>
                  {ultimoKm && <span className="ml-2">— {ultimoKm.toLocaleString('es-PE')} km</span>}
                </p>
              )}
            </div>
          </div>

          {/* Client info */}
          {cliente && (
            <div className="sm:text-right bg-gray-50 rounded-lg p-4 sm:min-w-[180px]">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Propietario</p>
              <p className="font-semibold text-gray-800 text-sm">{cliente.nombre}</p>
              {cliente.telefono && (
                <p className="text-sm text-gray-500">{cliente.telefono}</p>
              )}
              <Link
                to={`/clientes/${cliente.id}/editar`}
                className="text-xs text-[#1F3864] hover:underline mt-1 inline-block"
              >
                Ver cliente →
              </Link>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 mt-5 pt-4 border-t border-gray-100">
          <Link
            to={`/servicios/nuevo?vehiculo_id=${vehiculo.id}`}
            className="py-2 px-5 text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #1F3864, #0ea5e9)' }}
          >
            + Nueva atención
          </Link>
          <Link
            to={`/vehiculos/${vehiculo.id}/editar`}
            className="btn-secondary text-sm py-2 px-4"
          >
            Editar vehículo
          </Link>
        </div>
      </div>

      {/* Maintenance suggestions */}
      {mantenimientos.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
            Mantenimientos sugeridos
            {vehiculo.marca_vehiculo && (
              <span className="ml-2 text-xs font-normal text-gray-400 normal-case">
                para {vehiculo.marca_vehiculo}
              </span>
            )}
          </h2>
          <div className="flex flex-wrap gap-2">
            {mantenimientos.map((m) => {
              const nextKm = ultimoKm && m.intervalo_km ? ultimoKm + m.intervalo_km : null
              return (
                <div
                  key={m.id}
                  className="flex flex-col px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-xs"
                >
                  <span className="font-semibold text-gray-700">
                    {TIPO_LABEL[m.tipo_servicio] ?? m.tipo_servicio}
                  </span>
                  {m.intervalo_km && (
                    <span className="text-gray-500">
                      c/ {m.intervalo_km.toLocaleString('es-PE')} km
                      {nextKm && (
                        <span className="ml-1 text-[#1F3864] font-medium">
                          → {nextKm.toLocaleString('es-PE')} km
                        </span>
                      )}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Service history */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
            Historial de atenciones
          </h2>
          <span className="text-xs text-gray-400">{servicios.length} registros</span>
        </div>

        {loadingServicios ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : servicios.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-gray-400 text-sm mb-3">Sin atenciones registradas</p>
            <Link
              to={`/servicios/nuevo?vehiculo_id=${vehiculo.id}`}
              className="text-sm font-medium text-[#1F3864] hover:underline"
            >
              Registrar primera atención →
            </Link>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Fecha</th>
                    <th className="text-left pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Km</th>
                    <th className="text-left pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Descripción</th>
                    <th className="text-left pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Estado</th>
                    <th className="text-right pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {servicios.map((s) => {
                    const est = ESTADO_CONFIG[s.estado as EstadoServicio] ?? ESTADO_CONFIG.pendiente
                    return (
                      <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 text-gray-700 whitespace-nowrap">{formatDate(s.fecha_servicio)}</td>
                        <td className="py-3 text-gray-500 whitespace-nowrap">
                          {s.kilometraje ? s.kilometraje.toLocaleString('es-PE') + ' km' : '—'}
                        </td>
                        <td className="py-3 text-gray-700 max-w-xs truncate">{s.descripcion}</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${est.bg} ${est.text}`}>
                            {est.label}
                          </span>
                        </td>
                        <td className="py-3 text-right font-semibold text-gray-800">
                          {formatCurrency(s.total)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden space-y-3">
              {servicios.map((s) => {
                const est = ESTADO_CONFIG[s.estado as EstadoServicio] ?? ESTADO_CONFIG.pendiente
                return (
                  <div key={s.id} className="border border-gray-100 rounded-lg p-3">
                    <div className="flex items-start justify-between mb-1">
                      <span className="text-sm font-medium text-gray-800">{formatDate(s.fecha_servicio)}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${est.bg} ${est.text}`}>
                        {est.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-1 line-clamp-2">{s.descripcion}</p>
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>{s.kilometraje ? s.kilometraje.toLocaleString('es-PE') + ' km' : 'Sin km'}</span>
                      <span className="font-semibold text-gray-700">{formatCurrency(s.total)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
