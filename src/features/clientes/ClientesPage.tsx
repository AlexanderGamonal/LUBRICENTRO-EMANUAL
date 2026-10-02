import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Ban, CircleCheck, Pencil, Plus, Search, UserPlus, UserSearch } from 'lucide-react'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { ConfirmDialog, DataTable, EmptyState } from '@/shared/ui'
import type { Column } from '@/shared/ui'
import { cn } from '@/shared/utils/cn'
import type { Database } from '@/shared/types/database'

type ClienteRow = Database['public']['Tables']['clientes']['Row']

/** Mismos roles que protegen /clientes/nuevo y /clientes/:id/editar en router.tsx. */
const ROLES_EDITAN = ['admin', 'superadmin', 'vendedor']

const iconBtn =
  'inline-flex h-[44px] w-[44px] items-center justify-center rounded-lg text-fg-subtle transition-colors disabled:opacity-40 md:h-[34px] md:w-[34px]'

export default function ClientesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchInput, setSearchInput] = useState('')
  const search = useDebounce(searchInput, 300)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [pendiente, setPendiente] = useState<ClienteRow | null>(null)

  const canEdit = !!user && ROLES_EDITAN.includes(user.rol)

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
      setPendiente(null)
    }
  }

  const columns: Column<ClienteRow>[] = [
    {
      key: 'nombre',
      header: 'Nombre',
      mobile: 'title',
      cell: (c) => (
        <div>
          <div className="font-medium text-fg">{c.nombre}</div>
          {c.email && <div className="mt-0.5 text-xs font-normal text-fg-subtle">{c.email}</div>}
        </div>
      ),
    },
    {
      key: 'tipo',
      header: 'Tipo',
      cell: (c) => (
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
            c.tipo === 'empresa' ? 'bg-purple-100 text-purple-700' : 'bg-sky-100 text-sky-700',
          )}
        >
          {c.tipo === 'empresa' ? 'Empresa' : 'Natural'}
        </span>
      ),
    },
    { key: 'doc', header: 'RUC / DNI', cell: (c) => c.ruc_dni ?? <span className="text-fg-subtle">—</span> },
    { key: 'tel', header: 'Teléfono', cell: (c) => c.telefono ?? <span className="text-fg-subtle">—</span> },
    {
      key: 'estado',
      header: 'Estado',
      cell: (c) => (
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
            c.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600',
          )}
        >
          {c.activo ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
    {
      key: 'acciones',
      header: 'Acciones',
      mobile: 'actions',
      align: 'right',
      srOnlyHeader: true,
      cell: (c) => (
        <div className="flex items-center gap-1 md:justify-end">
          {canEdit && (
            <button
              type="button"
              onClick={() => navigate(`/clientes/${c.id}/editar`)}
              aria-label={`Editar a ${c.nombre}`}
              title="Editar cliente"
              className={cn(iconBtn, 'hover:bg-primary-700/10 hover:text-primary-700')}
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setPendiente(c)}
            disabled={togglingId === c.id}
            aria-label={`${c.activo ? 'Desactivar' : 'Activar'} a ${c.nombre}`}
            title={c.activo ? 'Desactivar' : 'Activar'}
            className={cn(iconBtn, c.activo ? 'hover:bg-red-50 hover:text-red-600' : 'hover:bg-green-50 hover:text-green-700')}
          >
            {c.activo ? <Ban className="h-4 w-4" aria-hidden="true" /> : <CircleCheck className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="animate-fade-in p-4 sm:p-6">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary-700">Clientes</h1>
          <p className="mt-0.5 text-sm text-fg-muted">
            {isLoading ? '…' : `${clientes.length} cliente${clientes.length !== 1 ? 's' : ''} registrado${clientes.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
            <input
              type="search"
              aria-label="Buscar clientes por nombre"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar por nombre..."
              className="input-field w-full pl-9 pr-4 sm:w-64"
            />
          </div>

          {canEdit && (
            <button type="button" onClick={() => navigate('/clientes/nuevo')} className="btn-primary flex items-center justify-center gap-2 whitespace-nowrap">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nuevo cliente
            </button>
          )}
        </div>
      </div>

      <DataTable
        caption="Listado de clientes"
        columns={columns}
        rows={filtered}
        rowKey={(c) => c.id}
        loading={isLoading}
        skeletonRows={5}
        rowClassName={(c) => (c.activo ? undefined : 'bg-muted/60')}
        empty={
          search.trim() ? (
            <EmptyState
              icon={UserSearch}
              title="No se encontraron clientes"
              description={`No hay resultados para «${search}».`}
              action={
                <button type="button" className="btn-secondary" onClick={() => setSearchInput('')}>
                  Limpiar búsqueda
                </button>
              }
            />
          ) : (
            <EmptyState
              icon={UserPlus}
              title="Aún no hay clientes registrados"
              description={canEdit ? 'Registra el primero para asociarle vehículos, servicios y créditos.' : undefined}
              action={
                canEdit ? (
                  <button type="button" className="btn-primary" onClick={() => navigate('/clientes/nuevo')}>
                    Nuevo cliente
                  </button>
                ) : undefined
              }
            />
          )
        }
      />

      <ConfirmDialog
        open={!!pendiente}
        onOpenChange={(open) => !open && setPendiente(null)}
        title={pendiente?.activo ? '¿Desactivar cliente?' : '¿Activar cliente?'}
        description={pendiente ? `${pendiente.activo ? 'Desactivar' : 'Activar'} a «${pendiente.nombre}».` : undefined}
        confirmLabel={pendiente?.activo ? 'Desactivar' : 'Activar'}
        tone={pendiente?.activo ? 'danger' : 'primary'}
        loading={!!togglingId}
        onConfirm={() => (pendiente ? handleToggleActivo(pendiente) : undefined)}
      />
    </div>
  )
}
