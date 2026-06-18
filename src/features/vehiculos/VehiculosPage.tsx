import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { formatDate } from '@/shared/utils/formatters'

type ClienteJoin = {
  id: string
  nombre: string
  telefono: string | null
}

type VehiculoRow = {
  id: string
  placa: string
  marca_vehiculo: string | null
  modelo: string | null
  anio: number | null
  color: string | null
  activo: boolean
  updated_at: string
  clientes: ClienteJoin | null
}

function SkeletonRow() {
  return (
    <tr>
      {[...Array(6)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse" style={{ width: `${55 + i * 7}%` }} />
        </td>
      ))}
    </tr>
  )
}

function SkeletonCard() {
  return (
    <div className="card p-4 space-y-3 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-6 w-24 bg-gray-200 rounded" />
        <div className="h-4 w-16 bg-gray-100 rounded" />
      </div>
      <div className="h-4 w-40 bg-gray-200 rounded" />
      <div className="h-4 w-28 bg-gray-100 rounded" />
      <div className="flex gap-2 pt-1">
        <div className="h-7 w-16 bg-gray-200 rounded" />
        <div className="h-7 w-24 bg-gray-200 rounded" />
        <div className="h-7 w-16 bg-gray-100 rounded" />
      </div>
    </div>
  )
}

function EmptyState({ search }: { search: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <svg
        className="w-20 h-20 text-gray-300 mb-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 64 64"
        strokeWidth={1.2}
      >
        <rect x="4" y="20" width="56" height="28" rx="6" />
        <circle cx="16" cy="48" r="6" />
        <circle cx="48" cy="48" r="6" />
        <path d="M10 20l6-12h32l6 12" strokeLinecap="round" strokeLinejoin="round" />
        {search && (
          <>
            <line x1="50" y1="8" x2="58" y2="16" strokeLinecap="round" strokeWidth={2.5} />
            <line x1="58" y1="8" x2="50" y2="16" strokeLinecap="round" strokeWidth={2.5} />
          </>
        )}
      </svg>
      <p className="text-gray-500 font-medium text-lg">
        {search ? 'No se encontraron vehículos' : 'No hay vehículos registrados'}
      </p>
      <p className="text-gray-400 text-sm mt-1">
        {search
          ? `Ninguna placa coincide con "${search}" — intenta con otra búsqueda`
          : 'Registra el primer vehículo con el botón "+ Nuevo vehículo"'}
      </p>
    </div>
  )
}

export default function VehiculosPage() {
  const { user } = useAuth()
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebounce(searchInput, 300)

  const { data: vehiculos = [], isLoading } = useQuery<VehiculoRow[]>({
    queryKey: ['vehiculos', user?.sucursal_id, debouncedSearch],
    queryFn: async () => {
      if (!user?.sucursal_id) return []
      let query = supabase
        .from('vehiculos')
        .select('id, placa, marca_vehiculo, modelo, anio, color, activo, updated_at, clientes(id, nombre, telefono)')
        .eq('sucursal_id', user.sucursal_id)
        .eq('activo', true)
        .order('updated_at', { ascending: false })
        .limit(100)

      if (debouncedSearch.trim()) {
        query = query.ilike('placa', `%${debouncedSearch.trim()}%`)
      }

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as unknown as VehiculoRow[]
    },
    enabled: !!user?.sucursal_id,
  })

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSearchInput(e.target.value.toUpperCase())
  }

  function buildVehicleLabel(v: VehiculoRow): string {
    const parts = [v.marca_vehiculo, v.modelo, v.anio ? String(v.anio) : null].filter(Boolean)
    return parts.length > 0 ? parts.join(' ') : '—'
  }

  return (
    <div className="animate-fade-in p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1F3864]">Vehículos</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isLoading
              ? 'Cargando...'
              : `${vehiculos.length} vehículo${vehiculos.length !== 1 ? 's' : ''} encontrado${vehiculos.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search */}
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
              onChange={handleSearchChange}
              placeholder="Buscar por placa..."
              className="input-field pl-9 pr-4 w-full sm:w-64 font-mono"
              maxLength={8}
            />
          </div>

          <Link
            to="/vehiculos/nuevo"
            className="btn-primary flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <line x1="12" y1="5" x2="12" y2="19" strokeLinecap="round" strokeWidth={2} />
              <line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round" strokeWidth={2} />
            </svg>
            Nuevo vehículo
          </Link>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="premium-table w-full">
            <thead>
              <tr>
                <th>Placa</th>
                <th>Marca / Modelo / Año</th>
                <th>Color</th>
                <th>Cliente</th>
                <th>Actualizado</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                [...Array(6)].map((_, i) => <SkeletonRow key={i} />)
              ) : vehiculos.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState search={debouncedSearch} />
                  </td>
                </tr>
              ) : (
                vehiculos.map((v) => {
                  const cliente = v.clientes
                  const vehicleLabel = buildVehicleLabel(v)
                  return (
                    <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="bg-[#1F3864] text-white px-2 py-0.5 rounded text-sm font-mono font-bold tracking-wider">
                          {v.placa}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {vehicleLabel}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {v.color ?? <span className="text-gray-300 italic">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {cliente ? (
                          <div>
                            <div className="text-sm font-medium text-gray-800">{cliente.nombre}</div>
                            {cliente.telefono && (
                              <div className="text-xs text-gray-400 mt-0.5">{cliente.telefono}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Sin cliente</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(v.updated_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-3">
                          <Link
                            to={`/vehiculos/${v.id}`}
                            className="text-xs font-medium text-[#1F3864] hover:underline"
                          >
                            Ver
                          </Link>
                          <Link
                            to={`/servicios/nuevo?vehiculo_id=${v.id}`}
                            className="text-xs font-medium text-green-700 hover:underline"
                          >
                            Nueva atención
                          </Link>
                          <Link
                            to={`/vehiculos/${v.id}/editar`}
                            className="text-xs font-medium text-gray-500 hover:text-gray-700 hover:underline"
                          >
                            Editar
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          [...Array(4)].map((_, i) => <SkeletonCard key={i} />)
        ) : vehiculos.length === 0 ? (
          <div className="card">
            <EmptyState search={debouncedSearch} />
          </div>
        ) : (
          vehiculos.map((v) => {
            const cliente = v.clientes
            const vehicleLabel = buildVehicleLabel(v)
            return (
              <div key={v.id} className="card p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <span className="bg-[#1F3864] text-white px-3 py-1 rounded-lg text-base font-mono font-bold tracking-wider">
                    {v.placa}
                  </span>
                  <span className="text-xs text-gray-400">{formatDate(v.updated_at)}</span>
                </div>

                {vehicleLabel !== '—' && (
                  <p className="text-sm font-medium text-gray-700 mb-1">{vehicleLabel}</p>
                )}

                {v.color && (
                  <p className="text-xs text-gray-500 mb-2">Color: {v.color}</p>
                )}

                {cliente ? (
                  <div className="mb-3 bg-gray-50 rounded-lg px-3 py-2">
                    <p className="text-sm font-medium text-gray-700">{cliente.nombre}</p>
                    {cliente.telefono && (
                      <p className="text-xs text-gray-400 mt-0.5">{cliente.telefono}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic mb-3">Sin cliente asociado</p>
                )}

                <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-100">
                  <Link
                    to={`/vehiculos/${v.id}`}
                    className="text-xs font-semibold text-[#1F3864] hover:underline px-2 py-1 rounded hover:bg-[#1F3864]/5 transition-colors"
                  >
                    Ver detalle
                  </Link>
                  <Link
                    to={`/servicios/nuevo?vehiculo_id=${v.id}`}
                    className="text-xs font-semibold text-green-700 hover:underline px-2 py-1 rounded hover:bg-green-50 transition-colors"
                  >
                    Nueva atención
                  </Link>
                  <Link
                    to={`/vehiculos/${v.id}/editar`}
                    className="text-xs font-semibold text-gray-500 hover:underline px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                  >
                    Editar
                  </Link>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
