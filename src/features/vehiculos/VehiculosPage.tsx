import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Car, Plus, Search, SearchX } from 'lucide-react'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { formatDate } from '@/shared/utils/formatters'
import { DataTable, EmptyState } from '@/shared/ui'
import type { Column } from '@/shared/ui'

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

function buildVehicleLabel(v: VehiculoRow): string {
  const parts = [v.marca_vehiculo, v.modelo, v.anio ? String(v.anio) : null].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : '—'
}

const rowLink = 'inline-flex min-h-touch items-center text-sm font-semibold hover:underline md:min-h-0 md:text-xs md:font-medium'

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

  const columns: Column<VehiculoRow>[] = [
    {
      key: 'placa',
      header: 'Placa',
      mobile: 'title',
      cell: (v) => (
        <span className="rounded bg-primary-700 px-2 py-0.5 font-mono text-sm font-bold tracking-wider text-white">{v.placa}</span>
      ),
    },
    {
      key: 'vehiculo',
      header: 'Marca / Modelo / Año',
      mobile: 'subtitle',
      cell: (v) => buildVehicleLabel(v),
    },
    { key: 'color', header: 'Color', cell: (v) => v.color ?? <span className="text-fg-subtle">—</span> },
    {
      key: 'cliente',
      header: 'Cliente',
      cell: (v) =>
        v.clientes ? (
          <div>
            <div className="font-medium text-fg">{v.clientes.nombre}</div>
            {v.clientes.telefono && <div className="mt-0.5 text-xs text-fg-subtle">{v.clientes.telefono}</div>}
          </div>
        ) : (
          <span className="text-xs italic text-fg-subtle">Sin cliente</span>
        ),
    },
    { key: 'actualizado', header: 'Actualizado', hideBelowLg: true, cell: (v) => formatDate(v.updated_at) },
    {
      key: 'acciones',
      header: 'Acciones',
      mobile: 'actions',
      align: 'right',
      srOnlyHeader: true,
      cell: (v) => (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 md:justify-end md:gap-3">
          <Link to={`/vehiculos/${v.id}`} className={`${rowLink} text-primary-700`}>
            Ver
          </Link>
          <Link to={`/servicios/nuevo?vehiculo_id=${v.id}`} className={`${rowLink} text-green-700`}>
            Nueva atención
          </Link>
          <Link to={`/vehiculos/${v.id}/editar`} className={`${rowLink} text-fg-muted`}>
            Editar
          </Link>
        </div>
      ),
    },
  ]

  return (
    <div className="animate-fade-in p-4 sm:p-6">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary-700">Vehículos</h1>
          <p className="mt-0.5 text-sm text-fg-muted">
            {isLoading ? 'Cargando…' : `${vehiculos.length} vehículo${vehiculos.length !== 1 ? 's' : ''} encontrado${vehiculos.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
            <input
              type="search"
              aria-label="Buscar vehículo por placa"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
              placeholder="Buscar por placa..."
              autoCapitalize="characters"
              className="input-field w-full pl-9 pr-4 font-mono sm:w-64"
              maxLength={8}
            />
          </div>

          <Link to="/vehiculos/nuevo" className="btn-primary flex items-center justify-center gap-2 whitespace-nowrap">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nuevo vehículo
          </Link>
        </div>
      </div>

      <DataTable
        caption="Listado de vehículos"
        columns={columns}
        rows={vehiculos}
        rowKey={(v) => v.id}
        loading={isLoading}
        skeletonRows={5}
        empty={
          debouncedSearch.trim() ? (
            <EmptyState
              icon={SearchX}
              title="No se encontraron vehículos"
              description={`Ninguna placa coincide con «${debouncedSearch}». Prueba con otra búsqueda.`}
              action={
                <button type="button" className="btn-secondary" onClick={() => setSearchInput('')}>
                  Limpiar búsqueda
                </button>
              }
            />
          ) : (
            <EmptyState
              icon={Car}
              title="No hay vehículos registrados"
              description="Registra el primero para llevar el historial de atenciones por placa."
              action={
                <Link to="/vehiculos/nuevo" className="btn-primary">
                  Nuevo vehículo
                </Link>
              }
            />
          )
        }
      />
    </div>
  )
}
