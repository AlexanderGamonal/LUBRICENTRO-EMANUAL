import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import { useDebounce } from '@/shared/hooks/useDebounce'
import type { Database } from '@/shared/types/database'

type ClienteRow = Database['public']['Tables']['clientes']['Row']

function SkeletonRow() {
  return (
    <tr>
      {[...Array(6)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse" style={{ width: `${60 + i * 8}%` }} />
        </td>
      ))}
    </tr>
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
        <circle cx="32" cy="24" r="12" />
        <path d="M8 56c0-10 10.75-18 24-18s24 8 24 18" strokeLinecap="round" />
        {search && (
          <>
            <line x1="50" y1="14" x2="58" y2="22" strokeLinecap="round" strokeWidth={2.5} />
            <line x1="58" y1="14" x2="50" y2="22" strokeLinecap="round" strokeWidth={2.5} />
          </>
        )}
      </svg>
      <p className="text-gray-500 font-medium text-lg">
        {search ? 'No se encontraron clientes' : 'Aún no hay clientes registrados'}
      </p>
      <p className="text-gray-400 text-sm mt-1">
        {search
          ? `No hay resultados para "${search}"`
          : 'Registra tu primer cliente con el botón "Nuevo Cliente"'}
      </p>
    </div>
  )
}

export default function ClientesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [searchInput, setSearchInput] = useState('')
  const search = useDebounce(searchInput, 300)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const { data: clientes = [], isLoading } = useQuery<ClienteRow[]>({
    queryKey: ['clientes', user?.sucursal_id],
    queryFn: async () => {
      if (!user?.sucursal_id) return []
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('sucursal_id', user.sucursal_id)
        .order('nombre')
      if (error) throw error
      return data ?? []
    },
    enabled: !!user?.sucursal_id,
  })

  const filtered = useMemo(() => {
    if (!search.trim()) return clientes
    const lower = search.toLowerCase()
    return clientes.filter((c) => c.nombre.toLowerCase().includes(lower))
  }, [clientes, search])

  async function handleToggleActivo(cliente: ClienteRow) {
    const confirm = window.confirm(
      `¿${cliente.activo ? 'Desactivar' : 'Activar'} al cliente "${cliente.nombre}"?`
    )
    if (!confirm) return

    setTogglingId(cliente.id)
    try {
      const { error } = await supabase
        .from('clientes')
        .update({ activo: !cliente.activo })
        .eq('id', cliente.id)
      if (error) throw error
      await queryClient.invalidateQueries({ queryKey: ['clientes', user?.sucursal_id] })
      toast.success(`Cliente ${!cliente.activo ? 'activado' : 'desactivado'} correctamente`)
    } catch {
      toast.error('Error al actualizar el cliente')
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="animate-fade-in p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isLoading ? '...' : `${clientes.length} cliente${clientes.length !== 1 ? 's' : ''} registrado${clientes.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search */}
          <div className="relative">
            <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar por nombre..."
              className="input-field pl-9 pr-4 w-full sm:w-64"
            />
          </div>

          <button
            onClick={() => navigate('/clientes/nuevo')}
            className="btn-primary flex items-center gap-2 whitespace-nowrap"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <line x1="12" y1="5" x2="12" y2="19" strokeLinecap="round" />
              <line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round" />
            </svg>
            Nuevo Cliente
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="premium-table w-full">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Nombre
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  RUC / DNI
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Teléfono
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState search={search} />
                  </td>
                </tr>
              ) : (
                filtered.map((cliente) => (
                  <tr key={cliente.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{cliente.nombre}</div>
                      {cliente.email && (
                        <div className="text-xs text-gray-400 mt-0.5">{cliente.email}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          cliente.tipo === 'empresa'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-sky-100 text-sky-700'
                        }`}
                      >
                        {cliente.tipo === 'empresa' ? 'Empresa' : 'Natural'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {cliente.ruc_dni ?? (
                        <span className="text-gray-300 italic">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {cliente.telefono ?? (
                        <span className="text-gray-300 italic">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          cliente.activo
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {cliente.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => navigate(`/clientes/${cliente.id}/editar`)}
                          title="Editar cliente"
                          className="p-1.5 rounded-md text-gray-500 hover:text-[#1F3864] hover:bg-[#1F3864]/10 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleToggleActivo(cliente)}
                          disabled={togglingId === cliente.id}
                          title={cliente.activo ? 'Desactivar' : 'Activar'}
                          className={`p-1.5 rounded-md transition-colors disabled:opacity-40 ${
                            cliente.activo
                              ? 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                              : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                          }`}
                        >
                          {cliente.activo ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                              />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
