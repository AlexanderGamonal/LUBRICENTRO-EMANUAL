import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import { diasAtrasLima, formatCurrency, formatDate, hoyLima } from '@/shared/utils/formatters'
import { ClipboardList, Plus } from 'lucide-react'
import { DataTable, EmptyState } from '@/shared/ui'
import type { Column } from '@/shared/ui'
import { cn } from '@/shared/utils/cn'
import type { Database } from '@/shared/types/database'

type EstadoFiltro = 'todos' | 'pendiente' | 'terminado' | 'anulado'

type ServicioConJoin = Database['public']['Tables']['servicios']['Row'] & {
  vehiculos: { placa: string; marca_vehiculo: string | null; modelo: string | null } | null
  clientes:  { nombre: string; telefono: string | null } | null
}

const getDefaultDesde = () => diasAtrasLima(30)
const getDefaultHasta = () => hoyLima()

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

export default function ServiciosPage() {
  const { user } = useAuth()
  const [desde, setDesde] = useState(getDefaultDesde)
  const [hasta, setHasta] = useState(getDefaultHasta)
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>('todos')

  const { data: servicios, isLoading } = useQuery<ServicioConJoin[]>({
    queryKey: ['servicios', user?.sucursal_id, desde, hasta, estadoFiltro],
    queryFn: async () => {
      if (!user?.sucursal_id) return []
      let q = supabase
        .from('servicios')
        .select('*, vehiculos(placa, marca_vehiculo, modelo), clientes(nombre, telefono)')
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
      return (data ?? []) as unknown as ServicioConJoin[]
    },
    enabled: !!user?.sucursal_id,
  })

  const estadoOptions: { value: EstadoFiltro; label: string }[] = [
    { value: 'todos', label: 'Todos' },
    { value: 'terminado', label: 'Terminado' },
    { value: 'pendiente', label: 'Pendiente' },
    { value: 'anulado', label: 'Anulado' },
  ]

  const columns: Column<ServicioConJoin>[] = [
    {
      key: 'fecha',
      header: 'Fecha',
      mobile: 'hidden',
      cell: (s) => <span className="whitespace-nowrap">{formatDate(s.fecha_servicio)}</span>,
    },
    {
      key: 'vehiculo',
      header: 'Vehículo',
      mobile: 'title',
      cell: (s) =>
        s.vehiculos?.placa ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 md:block">
            <span className="rounded bg-primary-700 px-2 py-0.5 font-mono text-xs text-white">{s.vehiculos.placa}</span>
            {(s.vehiculos.marca_vehiculo || s.vehiculos.modelo) && (
              <span className="text-xs font-normal text-fg-muted md:mt-0.5 md:block">
                {[s.vehiculos.marca_vehiculo, s.vehiculos.modelo].filter(Boolean).join(' ')}
              </span>
            )}
            <span className="text-xs font-normal text-fg-subtle md:hidden">{formatDate(s.fecha_servicio)}</span>
          </div>
        ) : (
          <span className="text-fg-subtle">—</span>
        ),
    },
    { key: 'cliente', header: 'Cliente', cell: (s) => s.clientes?.nombre ?? <span className="text-fg-subtle">—</span> },
    {
      key: 'km',
      header: 'Km',
      hideBelowLg: true,
      cell: (s) =>
        s.kilometraje != null ? <span className="whitespace-nowrap">{s.kilometraje.toLocaleString('es-PE')} km</span> : <span className="text-fg-subtle">—</span>,
    },
    {
      key: 'descripcion',
      header: 'Descripción',
      mobile: 'subtitle',
      className: 'max-w-[220px]',
      cell: (s) => (
        <span title={s.descripcion} className="line-clamp-2 md:line-clamp-1">
          {s.descripcion}
        </span>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      cell: (s) => <span className="whitespace-nowrap font-medium text-fg">{formatCurrency(s.total)}</span>,
    },
    { key: 'estado', header: 'Estado', cell: (s) => <EstadoBadge estado={s.estado} /> },
    {
      key: 'accion',
      header: 'Acción',
      mobile: 'actions',
      srOnlyHeader: true,
      cell: (s) =>
        s.vehiculo_id ? (
          <Link
            to={`/vehiculos/${s.vehiculo_id}`}
            className="inline-flex min-h-touch items-center whitespace-nowrap text-sm font-semibold text-primary-700 hover:underline md:min-h-0 md:text-xs md:font-medium"
          >
            Ver vehículo
          </Link>
        ) : null,
    },
  ]

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-primary-700">Historial de servicios</h1>
        <Link to="/servicios/nuevo" className="btn-primary inline-flex items-center justify-center gap-2">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nueva atención
        </Link>
      </div>

      {/* Filtros */}
      <div className="space-y-4 rounded-xl border border-line bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="servicios-desde" className="label-text mb-0 whitespace-nowrap">
              Desde
            </label>
            <input
              id="servicios-desde"
              type="date"
              className="input-field py-1.5"
              value={desde}
              max={hasta}
              onChange={(e) => setDesde(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="servicios-hasta" className="label-text mb-0 whitespace-nowrap">
              Hasta
            </label>
            <input
              id="servicios-hasta"
              type="date"
              className="input-field py-1.5"
              value={hasta}
              min={desde}
              onChange={(e) => setHasta(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
          {estadoOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={estadoFiltro === opt.value}
              onClick={() => setEstadoFiltro(opt.value)}
              className={cn(
                'min-h-touch rounded-full border px-3.5 py-1 text-sm font-medium transition-colors md:min-h-0 md:py-1',
                estadoFiltro === opt.value
                  ? 'border-primary-700 bg-primary-700 text-white'
                  : 'border-line bg-card text-fg-muted hover:border-primary-700 hover:text-primary-700',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <DataTable
        caption="Historial de servicios"
        columns={columns}
        rows={servicios}
        rowKey={(s) => s.id}
        loading={isLoading}
        skeletonRows={5}
        empty={
          <EmptyState
            icon={ClipboardList}
            title="No hay servicios en el período seleccionado"
            description="Amplía el rango de fechas o cambia el filtro de estado."
            action={
              <Link to="/servicios/nuevo" className="btn-primary">
                Registrar atención
              </Link>
            }
          />
        }
      />
      {servicios && servicios.length > 0 && (
        <p className="text-xs text-fg-subtle">
          {servicios.length} resultado{servicios.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}
