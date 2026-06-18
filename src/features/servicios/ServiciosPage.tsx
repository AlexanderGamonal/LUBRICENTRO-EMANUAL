import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import { formatCurrency, formatDate } from '@/shared/utils/formatters'
import { cn } from '@/shared/utils/cn'
import type { Database } from '@/shared/types/database'

type ServicioDetalle = Database['public']['Views']['vw_servicios_detalle']['Row']
type EstadoFiltro = 'todos' | 'pendiente' | 'terminado' | 'anulado'

function getDefaultDesde(): string {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().split('T')[0]
}

function getDefaultHasta(): string {
  return new Date().toISOString().split('T')[0]
}

function EstadoBadge({ estado }: { estado: string }) {
  const styles: Record<string, string> = {
    pendiente: 'bg-yellow-100 text-yellow-700',
    terminado: 'bg-green-100 text-green-700',
    anulado: 'bg-red-100 text-red-600',
  }
  const labels: Record<string, string> = {
    pendiente: 'Pendiente',
    terminado: 'Terminado',
    anulado: 'Anulado',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
        styles[estado] ?? 'bg-gray-100 text-gray-600'
      )}
    >
      {labels[estado] ?? estado}
    </span>
  )
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: 8 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded w-full" />
        </td>
      ))}
    </tr>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 animate-pulse space-y-2">
      <div className="flex justify-between">
        <div className="h-5 w-24 bg-gray-200 rounded" />
        <div className="h-4 w-20 bg-gray-200 rounded" />
      </div>
      <div className="h-4 w-48 bg-gray-200 rounded" />
      <div className="h-4 w-32 bg-gray-200 rounded" />
      <div className="flex justify-between items-center pt-1">
        <div className="h-4 w-20 bg-gray-200 rounded" />
        <div className="h-5 w-16 bg-gray-200 rounded" />
      </div>
    </div>
  )
}

export default function ServiciosPage() {
  const { user } = useAuth()
  const [desde, setDesde] = useState(getDefaultDesde)
  const [hasta, setHasta] = useState(getDefaultHasta)
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>('todos')

  const { data: servicios, isLoading } = useQuery({
    queryKey: ['servicios', user?.sucursal_id, desde, hasta, estadoFiltro],
    queryFn: async () => {
      if (!user?.sucursal_id) return []
      let q = supabase
        .from('vw_servicios_detalle')
        .select('*')
        .eq('sucursal_id', user.sucursal_id)
        .gte('fecha_servicio', desde)
        .lte('fecha_servicio', hasta)
        .order('fecha_servicio', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(200)

      if (estadoFiltro !== 'todos') {
        q = q.eq('estado', estadoFiltro)
      }

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as ServicioDetalle[]
    },
    enabled: !!user?.sucursal_id,
  })

  const estadoOptions: { value: EstadoFiltro; label: string }[] = [
    { value: 'todos', label: 'Todos' },
    { value: 'terminado', label: 'Terminado' },
    { value: 'pendiente', label: 'Pendiente' },
    { value: 'anulado', label: 'Anulado' },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#1F3864]">Servicios / Atenciones</h1>
        <Link
          to="/servicios/nuevo"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity"
          style={{ background: 'linear-gradient(135deg, #1F3864, #0ea5e9)' }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nueva atención
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-4">
        {/* Date range */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <label className="label-text whitespace-nowrap">Desde</label>
            <input
              type="date"
              className="input-field py-1.5 text-sm"
              value={desde}
              max={hasta}
              onChange={(e) => setDesde(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="label-text whitespace-nowrap">Hasta</label>
            <input
              type="date"
              className="input-field py-1.5 text-sm"
              value={hasta}
              min={desde}
              onChange={(e) => setHasta(e.target.value)}
            />
          </div>
        </div>

        {/* Estado pills */}
        <div className="flex flex-wrap gap-2">
          {estadoOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setEstadoFiltro(opt.value)}
              className={cn(
                'px-3 py-1 rounded-full text-sm font-medium border transition-colors',
                estadoFiltro === opt.value
                  ? 'bg-[#1F3864] text-white border-[#1F3864]'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-[#1F3864] hover:text-[#1F3864]'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden sm:block bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Vehículo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Km</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Descripción</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              ) : !servicios || servicios.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                    No hay servicios en el período seleccionado
                  </td>
                </tr>
              ) : (
                servicios.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                      {formatDate(s.fecha_servicio)}
                    </td>
                    <td className="px-4 py-3">
                      {s.placa ? (
                        <div>
                          <span className="bg-[#1F3864] text-white text-xs font-mono px-2 py-0.5 rounded">
                            {s.placa}
                          </span>
                          {(s.marca_vehiculo || s.modelo) && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {[s.marca_vehiculo, s.modelo].filter(Boolean).join(' ')}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {s.cliente_nombre ?? <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                      {s.kilometraje != null
                        ? `${s.kilometraje.toLocaleString('es-PE')} km`
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 max-w-[220px]">
                      <span title={s.descripcion}>
                        {s.descripcion.length > 40
                          ? `${s.descripcion.slice(0, 40)}…`
                          : s.descripcion}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-right whitespace-nowrap text-gray-800">
                      {formatCurrency(s.total)}
                    </td>
                    <td className="px-4 py-3">
                      <EstadoBadge estado={s.estado} />
                    </td>
                    <td className="px-4 py-3">
                      {s.vehiculo_id && (
                        <Link
                          to={`/vehiculos/${s.vehiculo_id}`}
                          className="text-[#1F3864] text-xs hover:underline"
                        >
                          Ver vehículo
                        </Link>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {servicios && servicios.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 text-xs text-gray-400">
            {servicios.length} resultado{servicios.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Mobile Cards */}
      <div className="sm:hidden space-y-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
        ) : !servicios || servicios.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center text-gray-400">
            No hay servicios en el período seleccionado
          </div>
        ) : (
          servicios.map((s) => (
            <div key={s.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {s.placa && (
                    <span className="bg-[#1F3864] text-white text-xs font-mono px-2 py-0.5 rounded">
                      {s.placa}
                    </span>
                  )}
                  <span className="text-xs text-gray-500">{formatDate(s.fecha_servicio)}</span>
                </div>
                <EstadoBadge estado={s.estado} />
              </div>

              <p className="text-sm text-gray-800">
                {s.descripcion.length > 60
                  ? `${s.descripcion.slice(0, 60)}…`
                  : s.descripcion}
              </p>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                {s.cliente_nombre && (
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    {s.cliente_nombre}
                  </span>
                )}
                {s.kilometraje != null && (
                  <span>{s.kilometraje.toLocaleString('es-PE')} km</span>
                )}
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-gray-50">
                <span className="text-base font-semibold text-[#1F3864]">
                  {formatCurrency(s.total)}
                </span>
                {s.vehiculo_id && (
                  <Link
                    to={`/vehiculos/${s.vehiculo_id}`}
                    className="text-[#1F3864] text-xs hover:underline"
                  >
                    Ver vehículo →
                  </Link>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
