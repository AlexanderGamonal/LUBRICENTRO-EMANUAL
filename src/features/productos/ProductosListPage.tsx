import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useProductos, useProductoMutations } from './hooks/useProductos'
import { useAuth } from '@/features/auth/AuthProvider'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { formatCurrency } from '@/shared/utils/formatters'
import { supabase } from '@/shared/lib/supabase'
import { Package, Plus, SearchX } from 'lucide-react'
import { ConfirmDialog, DataTable, EmptyState } from '@/shared/ui'
import type { Column } from '@/shared/ui'
import type { Database } from '@/shared/types/database'

type ProductoRow = Database['public']['Views']['vw_productos_detalle']['Row']
type StockEstado = ProductoRow['stock_estado']

function StockBadge({ estado }: { estado: StockEstado }) {
  if (estado === 'agotado') return <span className="badge-agotado">Agotado</span>
  if (estado === 'bajo') return <span className="badge-bajo">Bajo</span>
  return <span className="badge-ok">OK</span>
}

function MargenBadge({ precio, costo }: { precio: number; costo: number }) {
  if (!costo || costo === 0) {
    return <span className="text-xs text-fg-subtle italic">Sin costo</span>
  }
  const margen = precio - costo
  const pct = precio > 0 ? (margen / precio) * 100 : 0
  const color =
    pct >= 30 ? 'text-green-700 bg-green-50' :
    pct >= 10 ? 'text-yellow-700 bg-yellow-50' :
                'text-red-700 bg-red-50'
  return (
    <div className="md:text-right">
      <div className={`text-xs font-semibold px-1.5 py-0.5 rounded inline-block ${color}`}>
        {pct.toFixed(1)}%
      </div>
      <div className="text-xs text-gray-500 mt-0.5">{formatCurrency(margen)}</div>
    </div>
  )
}

export function ProductosListPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  // `?q=` llega desde el buscador global (Ctrl+K)
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '')
  const [categoriaId, setCategoriaId] = useState('')
  const [confirmDesactivar, setConfirmDesactivar] = useState<string | null>(null)
  const debouncedSearch = useDebounce(search, 300)

  const { data: productos, isLoading } = useProductos({
    search: debouncedSearch,
    categoria_id: categoriaId || undefined,
  })
  const { desactivarProducto } = useProductoMutations()

  const { data: categorias } = useQuery({
    queryKey: ['categorias', user?.sucursal_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('categorias')
        .select('id, nombre')
        .eq('sucursal_id', user!.sucursal_id)
        .eq('activa', true)
        .order('nombre')
      return data ?? []
    },
    enabled: !!user,
  })

  const canEdit =
    user && ['admin', 'superadmin', 'almacen'].includes(user.rol)

  const hasFilters = !!debouncedSearch || !!categoriaId

  const columns: Column<ProductoRow>[] = [
    {
      key: 'codigo',
      header: 'Código',
      mobile: 'hidden',
      cell: (p) => <span className="font-mono text-xs text-fg">{p.codigo_interno}</span>,
    },
    {
      key: 'nombre',
      header: 'Nombre',
      mobile: 'title',
      cell: (p) => (
        <div>
          <div className="font-medium text-fg">{p.nombre}</div>
          <div className="text-xs text-fg-subtle">
            <span className="font-mono md:hidden">{p.codigo_interno}</span>
            {p.marca && <span className="md:block"><span className="md:hidden"> · </span>{p.marca}</span>}
          </div>
        </div>
      ),
    },
    { key: 'categoria', header: 'Categoría', hideBelowLg: true, cell: (p) => p.categoria_nombre ?? '—' },
    {
      key: 'ubicacion',
      header: 'Ubicación',
      cell: (p) =>
        p.ubicacion_codigo ? (
          <span className="rounded bg-blue-50 px-2 py-0.5 font-mono text-xs text-primary-700">{p.ubicacion_codigo}</span>
        ) : (
          '—'
        ),
    },
    {
      key: 'stock',
      header: 'Stock',
      cell: (p) => (
        <div>
          <StockBadge estado={p.stock_estado} />
          <div className="mt-0.5 text-xs text-fg-subtle">
            {p.stock_actual} / mín {p.stock_minimo}
          </div>
        </div>
      ),
    },
    {
      key: 'precio',
      header: 'P. Venta',
      cell: (p) => <span className="font-medium text-fg">{formatCurrency(p.precio_venta)}</span>,
    },
    {
      key: 'margen',
      header: 'Margen',
      align: 'right',
      hideBelowLg: true,
      cell: (p) => <MargenBadge precio={p.precio_venta} costo={p.costo} />,
    },
    {
      key: 'acciones',
      header: 'Acciones',
      mobile: 'actions',
      srOnlyHeader: !canEdit,
      cell: (p) =>
        canEdit ? (
          <div className="flex gap-3">
            <Link
              to={`/productos/${p.id}/editar`}
              className="inline-flex min-h-touch items-center text-sm font-medium text-primary-700 hover:text-primary-900 md:min-h-0 md:text-xs"
            >
              Editar
            </Link>
            <button
              type="button"
              onClick={() => setConfirmDesactivar(p.id)}
              className="inline-flex min-h-touch items-center text-sm font-medium text-red-600 hover:text-red-800 md:min-h-0 md:text-xs"
            >
              Desactivar
            </button>
          </div>
        ) : null,
    },
  ]

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-fg">Productos</h1>
        {canEdit && (
          <Link to="/productos/nuevo" className="btn-primary inline-flex items-center gap-2">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nuevo producto
          </Link>
        )}
      </div>

      {/* Filtros */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          aria-label="Buscar productos"
          placeholder="Buscar por nombre, código o marca..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field sm:max-w-xs"
        />
        <select
          aria-label="Filtrar por categoría"
          value={categoriaId}
          onChange={(e) => setCategoriaId(e.target.value)}
          className="input-field sm:max-w-xs"
        >
          <option value="">Todas las categorías</option>
          {categorias?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </div>

      <DataTable
        caption="Listado de productos"
        columns={columns}
        rows={productos}
        rowKey={(p) => p.id}
        loading={isLoading}
        empty={
          hasFilters ? (
            <EmptyState
              icon={SearchX}
              title="Ningún producto coincide con la búsqueda"
              description="Prueba con otro nombre, código o marca, o quita el filtro de categoría."
              action={
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setSearch('')
                    setCategoriaId('')
                  }}
                >
                  Limpiar filtros
                </button>
              }
            />
          ) : (
            <EmptyState
              icon={Package}
              title="Aún no hay productos"
              description={canEdit ? 'Crea el primero o impórtalos desde un Excel.' : 'Cuando el almacén los registre, aparecerán aquí.'}
              action={
                canEdit ? (
                  <Link to="/productos/nuevo" className="btn-primary inline-flex items-center gap-2">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Nuevo producto
                  </Link>
                ) : undefined
              }
            />
          )
        }
      />

      <ConfirmDialog
        open={!!confirmDesactivar}
        onOpenChange={(open) => !open && setConfirmDesactivar(null)}
        title="¿Desactivar producto?"
        description="El producto no será eliminado, solo quedará inactivo."
        confirmLabel="Desactivar"
        loading={desactivarProducto.isPending}
        onConfirm={() => {
          if (confirmDesactivar) desactivarProducto.mutate(confirmDesactivar)
          setConfirmDesactivar(null)
        }}
      />
    </div>
  )
}
