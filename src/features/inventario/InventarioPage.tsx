import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import { formatCurrency, formatDateTime } from '@/shared/utils/formatters'
import { cn } from '@/shared/utils/cn'
import type { Database, TipoMovimientoStock } from '@/shared/types/database'

type ValorInventario = Database['public']['Views']['vw_valor_inventario']['Row']
type StockBajo = Database['public']['Views']['vw_stock_bajo']['Row']
type MovimientoDetalle = Database['public']['Views']['vw_movimientos_stock_detalle']['Row']

type Tab = 'resumen' | 'stock_bajo' | 'movimientos'

const DIAS_OPCIONES = [7, 30, 90] as const

const TIPO_COLORS: Record<TipoMovimientoStock, string> = {
  entrada: 'bg-green-100 text-green-700',
  salida: 'bg-red-100 text-red-700',
  ajuste: 'bg-blue-100 text-blue-700',
  perdida: 'bg-orange-100 text-orange-700',
  devolucion: 'bg-purple-100 text-purple-700',
  venta: 'bg-pink-100 text-pink-700',
  servicio: 'bg-cyan-100 text-cyan-700',
}

const TIPO_LABELS: Record<TipoMovimientoStock, string> = {
  entrada: 'Entrada',
  salida: 'Salida',
  ajuste: 'Ajuste',
  perdida: 'Pérdida',
  devolucion: 'Devolución',
  venta: 'Venta',
  servicio: 'Servicio',
}

export function InventarioPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('resumen')
  const [dias, setDias] = useState<7 | 30 | 90>(30)
  const [tipoFiltro, setTipoFiltro] = useState<TipoMovimientoStock | ''>('')

  // ---- Tab 1: Resumen ----
  const { data: valorInventario, isLoading: loadingValor } = useQuery<ValorInventario[]>({
    queryKey: ['valor_inventario', user?.sucursal_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vw_valor_inventario')
        .select('*')
        .eq('sucursal_id', user!.sucursal_id)
        .order('categoria')
      if (error) throw error
      return data
    },
    enabled: !!user && tab === 'resumen',
  })

  const totalProductos = valorInventario?.reduce((s, r) => s + r.total_productos, 0) ?? 0
  const totalUnidades = valorInventario?.reduce((s, r) => s + r.total_unidades, 0) ?? 0
  const totalValorVenta = valorInventario?.reduce((s, r) => s + r.valor_venta, 0) ?? 0
  const totalValorCosto = valorInventario?.reduce((s, r) => s + r.valor_costo, 0) ?? 0
  const totalUtilidad = totalValorVenta - totalValorCosto
  const margenPct = totalValorVenta > 0 ? (totalUtilidad / totalValorVenta) * 100 : 0

  // ---- Tab 2: Stock Bajo ----
  const { data: stockBajo, isLoading: loadingStockBajo } = useQuery<StockBajo[]>({
    queryKey: ['stock_bajo', user?.sucursal_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vw_stock_bajo')
        .select('*')
        .eq('sucursal_id', user!.sucursal_id)
        .order('deficit', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!user && tab === 'stock_bajo',
  })

  // ---- Tab 3: Movimientos ----
  const fechaDesde = new Date()
  fechaDesde.setDate(fechaDesde.getDate() - dias)

  const { data: movimientos, isLoading: loadingMovimientos } = useQuery<MovimientoDetalle[]>({
    queryKey: ['movimientos', user?.sucursal_id, dias, tipoFiltro],
    queryFn: async () => {
      let q = supabase
        .from('vw_movimientos_stock_detalle')
        .select('*')
        .eq('sucursal_id', user!.sucursal_id)
        .gte('created_at', fechaDesde.toISOString())
        .order('created_at', { ascending: false })
        .limit(500)

      if (tipoFiltro) q = q.eq('tipo', tipoFiltro)

      const { data, error } = await q
      if (error) throw error
      return data
    },
    enabled: !!user && tab === 'movimientos',
  })

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Inventario</h1>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {([
          ['resumen', 'Resumen'],
          ['stock_bajo', 'Stock Bajo'],
          ['movimientos', 'Movimientos'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === key
                ? 'border-primary-700 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-700',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab: Resumen */}
      {tab === 'resumen' && (
        <div>
          {/* Tarjetas resumen */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="card">
              <p className="text-sm text-gray-500">Total Productos</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {loadingValor ? '—' : totalProductos.toLocaleString('es-PE')}
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">Total Unidades</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {loadingValor ? '—' : totalUnidades.toLocaleString('es-PE')}
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">Valor Inventario (Venta)</p>
              <p className="text-3xl font-bold text-primary-700 mt-1">
                {loadingValor ? '—' : formatCurrency(totalValorVenta)}
              </p>
            </div>
            <div className="card border-l-4 border-l-green-500">
              <p className="text-sm text-gray-500">Utilidad Potencial</p>
              <p className="text-3xl font-bold text-green-700 mt-1">
                {loadingValor ? '—' : formatCurrency(totalUtilidad)}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {loadingValor ? '' : `Margen ${margenPct.toFixed(1)}% sobre venta`}
              </p>
            </div>
          </div>

          {/* Tabla por categoría */}
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="font-semibold text-gray-800">
                Valor por Categoría
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-left text-gray-600">
                    <th className="px-4 py-3 font-medium">Categoría</th>
                    <th className="px-4 py-3 font-medium text-right">
                      Productos
                    </th>
                    <th className="px-4 py-3 font-medium text-right">
                      Unidades
                    </th>
                    <th className="px-4 py-3 font-medium text-right">
                      Valor Costo
                    </th>
                    <th className="px-4 py-3 font-medium text-right">
                      Valor Venta
                    </th>
                    <th className="px-4 py-3 font-medium text-right text-green-700">
                      Utilidad
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loadingValor &&
                    [1, 2, 3].map((n) => (
                      <tr key={n}>
                        {[1, 2, 3, 4, 5, 6].map((c) => (
                          <td key={c} className="px-4 py-3">
                            <div className="h-4 bg-gray-200 rounded animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))}
                  {!loadingValor &&
                    (!valorInventario || valorInventario.length === 0) && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-8 text-center text-gray-400"
                        >
                          Sin datos de inventario
                        </td>
                      </tr>
                    )}
                  {valorInventario?.map((row) => (
                    <tr key={row.categoria} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {row.categoria}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {row.total_productos}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {row.total_unidades}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {formatCurrency(row.valor_costo)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {formatCurrency(row.valor_venta)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-green-700">
                        {formatCurrency(row.valor_venta - row.valor_costo)}
                        <div className="text-xs font-normal text-gray-400">
                          {row.valor_venta > 0
                            ? `${(((row.valor_venta - row.valor_costo) / row.valor_venta) * 100).toFixed(1)}%`
                            : '—'}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {valorInventario && valorInventario.length > 0 && (
                    <tr className="bg-gray-50 font-semibold border-t border-gray-200">
                      <td className="px-4 py-3 text-gray-900">TOTAL</td>
                      <td className="px-4 py-3 text-right text-gray-900">
                        {totalProductos}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900">
                        {totalUnidades}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900">
                        {formatCurrency(totalValorCosto)}
                      </td>
                      <td className="px-4 py-3 text-right text-primary-700">
                        {formatCurrency(totalValorVenta)}
                      </td>
                      <td className="px-4 py-3 text-right text-green-700">
                        {formatCurrency(totalUtilidad)}
                        <div className="text-xs font-normal text-gray-500">
                          {margenPct.toFixed(1)}%
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Stock Bajo */}
      {tab === 'stock_bajo' && (
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">
              Productos con Stock Bajo o Agotado
            </h2>
            {stockBajo && (
              <span className="text-sm text-red-600 font-medium">
                {stockBajo.length} producto{stockBajo.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left text-gray-600">
                  <th className="px-4 py-3 font-medium">Código</th>
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">Ubicación</th>
                  <th className="px-4 py-3 font-medium text-right">
                    Stock Actual
                  </th>
                  <th className="px-4 py-3 font-medium text-right">
                    Stock Mínimo
                  </th>
                  <th className="px-4 py-3 font-medium text-right">Déficit</th>
                  <th className="px-4 py-3 font-medium">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loadingStockBajo &&
                  [1, 2, 3].map((n) => (
                    <tr key={n}>
                      {[1, 2, 3, 4, 5, 6, 7].map((c) => (
                        <td key={c} className="px-4 py-3">
                          <div className="h-4 bg-gray-200 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))}
                {!loadingStockBajo &&
                  (!stockBajo || stockBajo.length === 0) && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-12 text-center text-gray-400"
                      >
                        Todos los productos tienen stock suficiente
                      </td>
                    </tr>
                  )}
                {stockBajo?.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">
                      {p.codigo_interno}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{p.nombre}</div>
                      {p.marca && (
                        <div className="text-xs text-gray-400">{p.marca}</div>
                      )}
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
                    <td className="px-4 py-3 text-right">
                      <span
                        className={cn(
                          'font-semibold',
                          p.stock_actual === 0
                            ? 'text-red-600'
                            : 'text-yellow-600',
                        )}
                      >
                        {p.stock_actual}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {p.stock_minimo}
                    </td>
                    <td className="px-4 py-3 text-right text-red-600 font-medium">
                      {p.deficit}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/inventario/ajuste/${p.id}`}
                        className="text-xs text-primary-700 hover:text-primary-900 font-medium"
                      >
                        Ajustar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Movimientos */}
      {tab === 'movimientos' && (
        <div>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {DIAS_OPCIONES.map((d) => (
                <button
                  key={d}
                  onClick={() => setDias(d)}
                  className={cn(
                    'px-3 py-1.5 text-sm rounded-md transition-colors font-medium',
                    dias === d
                      ? 'bg-white shadow text-primary-700'
                      : 'text-gray-600 hover:text-gray-800',
                  )}
                >
                  {d} días
                </button>
              ))}
            </div>
            <select
              value={tipoFiltro}
              onChange={(e) =>
                setTipoFiltro(e.target.value as TipoMovimientoStock | '')
              }
              className="input-field max-w-xs"
            >
              <option value="">Todos los tipos</option>
              {(Object.keys(TIPO_LABELS) as TipoMovimientoStock[]).map(
                (tipo) => (
                  <option key={tipo} value={tipo}>
                    {TIPO_LABELS[tipo]}
                  </option>
                ),
              )}
            </select>
          </div>

          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-left text-gray-600">
                    <th className="px-4 py-3 font-medium">Fecha</th>
                    <th className="px-4 py-3 font-medium">Producto</th>
                    <th className="px-4 py-3 font-medium">Tipo</th>
                    <th className="px-4 py-3 font-medium text-right">
                      Cantidad
                    </th>
                    <th className="px-4 py-3 font-medium">Stock</th>
                    <th className="px-4 py-3 font-medium">Motivo</th>
                    <th className="px-4 py-3 font-medium">Usuario</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loadingMovimientos &&
                    [1, 2, 3, 4, 5].map((n) => (
                      <tr key={n}>
                        {[1, 2, 3, 4, 5, 6, 7].map((c) => (
                          <td key={c} className="px-4 py-3">
                            <div className="h-4 bg-gray-200 rounded animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))}
                  {!loadingMovimientos &&
                    (!movimientos || movimientos.length === 0) && (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-12 text-center text-gray-400"
                        >
                          No hay movimientos en el período seleccionado
                        </td>
                      </tr>
                    )}
                  {movimientos?.map((m) => {
                    const cantidadMostrar = m.tipo === 'ajuste'
                      ? m.cantidad_nueva - m.cantidad_anterior
                      : m.tipo === 'salida' || m.tipo === 'venta' || m.tipo === 'servicio' || m.tipo === 'perdida'
                      ? -m.cantidad
                      : m.cantidad

                    return (
                      <tr key={m.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                          {formatDateTime(m.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">
                            {m.producto_nombre}
                          </div>
                          <div className="text-xs text-gray-400 font-mono">
                            {m.codigo_interno}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'text-xs font-medium px-2 py-0.5 rounded-full',
                              TIPO_COLORS[m.tipo],
                            )}
                          >
                            {TIPO_LABELS[m.tipo]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          <span
                            className={
                              cantidadMostrar >= 0
                                ? 'text-green-600'
                                : 'text-red-600'
                            }
                          >
                            {cantidadMostrar >= 0 ? '+' : ''}
                            {cantidadMostrar}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          <span className="text-xs">
                            {m.cantidad_anterior} → {m.cantidad_nueva}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs max-w-[180px] truncate">
                          {m.motivo ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {m.usuario_nombre ?? '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
