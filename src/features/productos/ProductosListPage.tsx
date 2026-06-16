import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useProductos, useProductoMutations } from './hooks/useProductos'
import { useAuth } from '@/features/auth/AuthProvider'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { formatCurrency } from '@/shared/utils/formatters'
import { supabase } from '@/shared/lib/supabase'
import type { Database } from '@/shared/types/database'

type StockEstado = Database['public']['Views']['vw_productos_detalle']['Row']['stock_estado']

function StockBadge({ estado }: { estado: StockEstado }) {
  if (estado === 'agotado') return <span className="badge-agotado">Agotado</span>
  if (estado === 'bajo') return <span className="badge-bajo">Bajo</span>
  return <span className="badge-ok">OK</span>
}

export function ProductosListPage() {
  const { user } = useAuth()
  const [search, setSearch] = useState('')
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

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
        {canEdit && (
          <Link to="/productos/nuevo" className="btn-primary">
            + Nuevo Producto
          </Link>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Buscar por nombre, código o marca..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field max-w-xs"
        />
        <select
          value={categoriaId}
          onChange={(e) => setCategoriaId(e.target.value)}
          className="input-field max-w-xs"
        >
          <option value="">Todas las categorías</option>
          {categorias?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </div>

      {/* Tabla */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left text-gray-600">
                <th className="px-4 py-3 font-medium">Código</th>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Categoría</th>
                <th className="px-4 py-3 font-medium">Ubicación</th>
                <th className="px-4 py-3 font-medium">Stock</th>
                <th className="px-4 py-3 font-medium">P. Venta</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading &&
                [1, 2, 3].map((n) => (
                  <tr key={n}>
                    {[1, 2, 3, 4, 5, 6, 7].map((c) => (
                      <td key={c} className="px-4 py-3">
                        <div className="h-4 bg-gray-200 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))}
              {!isLoading && (!productos || productos.length === 0) && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    No se encontraron productos
                  </td>
                </tr>
              )}
              {productos?.map((p) => (
                <tr
                  key={p.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">
                    {p.codigo_interno}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{p.nombre}</div>
                    {p.marca && (
                      <div className="text-xs text-gray-400">{p.marca}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {p.categoria_nombre ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    {p.ubicacion_codigo ? (
                      <span className="font-mono text-xs bg-blue-50 text-primary-700 px-2 py-0.5 rounded">
                        {p.ubicacion_codigo}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <StockBadge estado={p.stock_estado} />
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {p.stock_actual} / mín {p.stock_minimo}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {formatCurrency(p.precio_venta)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {canEdit && (
                        <>
                          <Link
                            to={`/productos/${p.id}/editar`}
                            className="text-xs text-primary-700 hover:text-primary-900 font-medium"
                          >
                            Editar
                          </Link>
                          <button
                            onClick={() => setConfirmDesactivar(p.id)}
                            className="text-xs text-red-600 hover:text-red-800 font-medium"
                          >
                            Desactivar
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de confirmación */}
      {confirmDesactivar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-semibold text-gray-900 mb-2">
              ¿Desactivar producto?
            </h3>
            <p className="text-gray-500 text-sm mb-6">
              El producto no será eliminado, solo quedará inactivo.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDesactivar(null)}
                className="btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  desactivarProducto.mutate(confirmDesactivar)
                  setConfirmDesactivar(null)
                }}
                className="btn-danger flex-1"
                disabled={desactivarProducto.isPending}
              >
                Desactivar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
