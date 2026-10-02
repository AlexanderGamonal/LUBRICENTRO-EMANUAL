import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Boxes, History, PackageCheck, PiggyBank, Warehouse, Layers } from 'lucide-react'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import { formatCurrency, formatDateTime } from '@/shared/utils/formatters'
import { cn } from '@/shared/utils/cn'
import { DataTable, EmptyState, SegmentedControl, StatCard } from '@/shared/ui'
import type { Column } from '@/shared/ui'
import type { Database, TipoMovimientoStock } from '@/shared/types/database'

type ValorInventario = Database['public']['Views']['vw_valor_inventario']['Row']
type StockBajo = Database['public']['Views']['vw_stock_bajo']['Row']
type MovimientoDetalle = Database['public']['Views']['vw_movimientos_stock_detalle']['Row']

/** Fila de la tabla por categoría; la última (`esTotal`) resume todo el inventario. */
type FilaCategoria = ValorInventario & { esTotal?: boolean }

type Tab = 'resumen' | 'stock_bajo' | 'movimientos'
type Dias = '7' | '30' | '90'

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

/** Roles que pueden ajustar stock (igual que la ruta /inventario/ajuste/:id en router.tsx). */
const ROLES_AJUSTAN = ['admin', 'superadmin', 'almacen']

export function InventarioPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('resumen')
  const [dias, setDias] = useState<Dias>('30')
  const [tipoFiltro, setTipoFiltro] = useState<TipoMovimientoStock | ''>('')

  const esAdmin = user?.rol === 'admin' || user?.rol === 'superadmin'
  const puedeAjustar = !!user && ROLES_AJUSTAN.includes(user.rol)

  // ---- Resumen ----
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

  const filasCategoria: FilaCategoria[] =
    valorInventario && valorInventario.length > 0
      ? [
          ...valorInventario,
          {
            sucursal_id: valorInventario[0].sucursal_id,
            categoria: 'TOTAL',
            total_productos: totalProductos,
            total_unidades: totalUnidades,
            valor_costo: totalValorCosto,
            valor_venta: totalValorVenta,
            esTotal: true,
          },
        ]
      : []

  // ---- Stock bajo ----
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

  // ---- Movimientos ----
  const fechaDesde = new Date()
  fechaDesde.setDate(fechaDesde.getDate() - Number(dias))

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

  // ── Columnas ────────────────────────────────────────────────────────────────
  const utilidadDe = (r: FilaCategoria) => r.valor_venta - r.valor_costo
  const margenDe = (r: FilaCategoria) => (r.valor_venta > 0 ? `${((utilidadDe(r) / r.valor_venta) * 100).toFixed(1)}%` : '—')

  const columnasCategoria: Column<FilaCategoria>[] = [
    { key: 'categoria', header: 'Categoría', mobile: 'title', cell: (r) => <span className="font-medium text-fg">{r.categoria}</span> },
    { key: 'productos', header: 'Productos', align: 'right', cell: (r) => r.total_productos },
    { key: 'unidades', header: 'Unidades', align: 'right', cell: (r) => r.total_unidades },
    ...(esAdmin
      ? ([
          { key: 'costo', header: 'Valor costo', align: 'right', cell: (r) => formatCurrency(r.valor_costo) },
        ] as Column<FilaCategoria>[])
      : []),
    { key: 'venta', header: 'Valor venta', align: 'right', cell: (r) => <span className="font-medium text-fg">{formatCurrency(r.valor_venta)}</span> },
    ...(esAdmin
      ? ([
          {
            key: 'utilidad',
            header: 'Utilidad',
            align: 'right',
            cell: (r) => (
              <div className="font-semibold text-green-700">
                {formatCurrency(utilidadDe(r))}
                <div className="text-xs font-normal text-fg-subtle">{margenDe(r)}</div>
              </div>
            ),
          },
        ] as Column<FilaCategoria>[])
      : []),
  ]

  const columnasStockBajo: Column<StockBajo>[] = [
    { key: 'codigo', header: 'Código', mobile: 'hidden', cell: (p) => <span className="font-mono text-xs text-fg">{p.codigo_interno}</span> },
    {
      key: 'nombre',
      header: 'Nombre',
      mobile: 'title',
      cell: (p) => (
        <div>
          <div className="font-medium text-fg">{p.nombre}</div>
          <div className="text-xs font-normal text-fg-subtle">
            <span className="font-mono md:hidden">{p.codigo_interno}</span>
            {p.marca && <span className="md:block"><span className="md:hidden"> · </span>{p.marca}</span>}
          </div>
        </div>
      ),
    },
    {
      key: 'ubicacion',
      header: 'Ubicación',
      cell: (p) =>
        p.ubicacion_codigo ? <span className="rounded bg-blue-50 px-2 py-0.5 font-mono text-xs text-primary-700">{p.ubicacion_codigo}</span> : '—',
    },
    {
      key: 'actual',
      header: 'Stock actual',
      align: 'right',
      cell: (p) => <span className={cn('font-semibold', p.stock_actual === 0 ? 'text-red-700' : 'text-yellow-700')}>{p.stock_actual}</span>,
    },
    { key: 'minimo', header: 'Stock mínimo', align: 'right', cell: (p) => p.stock_minimo },
    { key: 'deficit', header: 'Déficit', align: 'right', cell: (p) => <span className="font-medium text-red-700">{p.deficit}</span> },
    {
      key: 'accion',
      header: 'Acción',
      mobile: 'actions',
      srOnlyHeader: true,
      cell: (p) =>
        puedeAjustar ? (
          <Link
            to={`/inventario/ajuste/${p.id}`}
            className="inline-flex min-h-touch items-center text-sm font-semibold text-primary-700 hover:text-primary-900 md:min-h-0 md:text-xs md:font-medium"
          >
            Ajustar stock
          </Link>
        ) : null,
    },
  ]

  const cantidadMostrada = (m: MovimientoDetalle) =>
    m.tipo === 'ajuste'
      ? m.cantidad_nueva - m.cantidad_anterior
      : m.tipo === 'salida' || m.tipo === 'venta' || m.tipo === 'servicio' || m.tipo === 'perdida'
        ? -m.cantidad
        : m.cantidad

  const columnasMovimientos: Column<MovimientoDetalle>[] = [
    { key: 'fecha', header: 'Fecha', mobile: 'subtitle', cell: (m) => <span className="whitespace-nowrap text-fg-muted">{formatDateTime(m.created_at)}</span> },
    {
      key: 'producto',
      header: 'Producto',
      mobile: 'title',
      cell: (m) => (
        <div>
          <div className="font-medium text-fg">{m.producto_nombre}</div>
          <div className="font-mono text-xs font-normal text-fg-subtle">{m.codigo_interno}</div>
        </div>
      ),
    },
    {
      key: 'tipo',
      header: 'Tipo',
      cell: (m) => <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', TIPO_COLORS[m.tipo])}>{TIPO_LABELS[m.tipo]}</span>,
    },
    {
      key: 'cantidad',
      header: 'Cantidad',
      align: 'right',
      cell: (m) => {
        const c = cantidadMostrada(m)
        return (
          <span className={cn('font-semibold', c >= 0 ? 'text-green-700' : 'text-red-700')}>
            {c >= 0 ? '+' : ''}
            {c}
          </span>
        )
      },
    },
    {
      key: 'stock',
      header: 'Stock',
      cell: (m) => (
        <span className="whitespace-nowrap text-xs">
          {m.cantidad_anterior} → {m.cantidad_nueva}
        </span>
      ),
    },
    { key: 'motivo', header: 'Motivo', hideBelowLg: true, className: 'max-w-[180px] truncate text-xs', cell: (m) => m.motivo ?? '—' },
    { key: 'usuario', header: 'Usuario', hideBelowLg: true, className: 'text-xs', cell: (m) => m.usuario_nombre ?? '—' },
  ]

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <h1 className="mb-5 text-2xl font-bold text-fg">Inventario</h1>

      <SegmentedControl
        label="Sección del inventario"
        value={tab}
        onChange={setTab}
        className="mb-5"
        options={[
          { value: 'resumen', label: 'Resumen' },
          { value: 'stock_bajo', label: 'Stock bajo', count: stockBajo?.length },
          { value: 'movimientos', label: 'Movimientos' },
        ]}
      />

      {tab === 'resumen' && (
        <div className="space-y-5">
          <div className={cn('grid grid-cols-2 gap-3', esAdmin ? 'lg:grid-cols-4' : 'lg:grid-cols-3')}>
            <StatCard stackOnMobile label="Total productos" value={totalProductos.toLocaleString('es-PE')} icon={Boxes} tone="accent" loading={loadingValor} />
            <StatCard stackOnMobile label="Total unidades" value={totalUnidades.toLocaleString('es-PE')} icon={Layers} tone="neutral" loading={loadingValor} />
            <StatCard
              stackOnMobile
              label="Valor del inventario"
              value={formatCurrency(totalValorVenta)}
              hint="a precio de venta"
              icon={Warehouse}
              tone="neutral"
              loading={loadingValor}
              className={esAdmin ? undefined : 'col-span-2 lg:col-span-1'}
            />
            {esAdmin && (
              <StatCard
                stackOnMobile
                label="Utilidad potencial"
                value={formatCurrency(totalUtilidad)}
                hint={`Margen ${margenPct.toFixed(1)}%`}
                icon={PiggyBank}
                tone="success"
                loading={loadingValor}
              />
            )}
          </div>

          <div>
            <h2 className="mb-3 text-base font-semibold text-fg">Valor por categoría</h2>
            <DataTable
              caption="Valor del inventario por categoría"
              columns={columnasCategoria}
              rows={filasCategoria}
              rowKey={(r) => (r.esTotal ? '__total' : r.categoria)}
              loading={loadingValor}
              skeletonRows={3}
              rowClassName={(r) => (r.esTotal ? 'bg-muted font-semibold' : undefined)}
              empty={<EmptyState icon={PackageCheck} title="Sin datos de inventario" description="Cuando registres productos con stock, verás aquí su valor por categoría." />}
            />
          </div>
        </div>
      )}

      {tab === 'stock_bajo' && (
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-fg">Productos con stock bajo o agotado</h2>
            {stockBajo && (
              <span className="text-sm font-medium text-red-700">
                {stockBajo.length} producto{stockBajo.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <DataTable
            caption="Productos con stock bajo o agotado"
            columns={columnasStockBajo}
            rows={stockBajo}
            rowKey={(p) => p.id}
            loading={loadingStockBajo}
            skeletonRows={3}
            empty={<EmptyState icon={PackageCheck} title="Todo en orden" description="Todos los productos tienen stock suficiente." />}
          />
        </div>
      )}

      {tab === 'movimientos' && (
        <div>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <SegmentedControl
              label="Período de movimientos"
              value={dias}
              onChange={setDias}
              options={[
                { value: '7', label: '7 días' },
                { value: '30', label: '30 días' },
                { value: '90', label: '90 días' },
              ]}
            />
            <select
              aria-label="Filtrar por tipo de movimiento"
              value={tipoFiltro}
              onChange={(e) => setTipoFiltro(e.target.value as TipoMovimientoStock | '')}
              className="input-field sm:max-w-xs"
            >
              <option value="">Todos los tipos</option>
              {(Object.keys(TIPO_LABELS) as TipoMovimientoStock[]).map((tipo) => (
                <option key={tipo} value={tipo}>
                  {TIPO_LABELS[tipo]}
                </option>
              ))}
            </select>
          </div>

          <DataTable
            caption="Movimientos de stock"
            columns={columnasMovimientos}
            rows={movimientos}
            rowKey={(m) => m.id}
            loading={loadingMovimientos}
            skeletonRows={5}
            empty={<EmptyState icon={History} title="No hay movimientos en el período" description="Prueba con un rango mayor o quita el filtro de tipo." />}
          />
        </div>
      )}
    </div>
  )
}
