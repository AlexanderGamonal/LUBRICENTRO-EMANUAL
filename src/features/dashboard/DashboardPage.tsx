import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import { formatCurrency } from '@/shared/utils/formatters'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import { cn } from '@/shared/utils/cn'
import type { Database } from '@/shared/types/database'

type GananciasRow = Database['public']['Views']['vw_ganancias_ventas']['Row']
type Periodo = 'hoy' | 'semana' | 'mes'

function fechaDesde(periodo: Periodo): string {
  const d = new Date()
  if (periodo === 'hoy') {
    d.setHours(0, 0, 0, 0)
  } else if (periodo === 'semana') {
    d.setDate(d.getDate() - 7)
    d.setHours(0, 0, 0, 0)
  } else {
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
  }
  // Retorna fecha en formato YYYY-MM-DD
  return d.toISOString().split('T')[0]
}

export function DashboardPage() {
  const { user } = useAuth()
  const [periodo, setPeriodo] = useState<Periodo>('mes')

  const { data: stockBajo } = useQuery({
    queryKey: ['stock-bajo-count', user?.sucursal_id],
    queryFn: async () => {
      const { count } = await supabase
        .from('vw_stock_bajo')
        .select('*', { count: 'exact', head: true })
        .eq('sucursal_id', user!.sucursal_id)
      return count ?? 0
    },
    enabled: !!user,
  })

  const { data: valorInventario } = useQuery({
    queryKey: ['valor-inventario', user?.sucursal_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('vw_valor_inventario')
        .select('valor_venta, valor_costo, total_productos, total_unidades')
        .eq('sucursal_id', user!.sucursal_id)
      return {
        valor:     (data ?? []).reduce((s, r) => s + Number(r.valor_venta), 0),
        productos: (data ?? []).reduce((s, r) => s + Number(r.total_productos), 0),
        unidades:  (data ?? []).reduce((s, r) => s + Number(r.total_unidades), 0),
      }
    },
    enabled: !!user,
  })

  // Feature 3: Ganancias por período usando vw_ganancias_ventas
  const { data: ganancias, isLoading: loadingGanancias } = useQuery<GananciasRow[]>({
    queryKey: ['ganancias-ventas', user?.sucursal_id, periodo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vw_ganancias_ventas')
        .select('sucursal_id, fecha, ingresos, costo_real, ganancia, total_ventas')
        .eq('sucursal_id', user!.sucursal_id)
        .gte('fecha', fechaDesde(periodo))
      if (error) throw error
      return (data ?? []) as GananciasRow[]
    },
    enabled: !!user,
  })

  const totalIngresos = ganancias?.reduce((s, r) => s + Number(r.ingresos), 0) ?? 0
  const totalGanancia = ganancias?.reduce((s, r) => s + Number(r.ganancia), 0) ?? 0
  const totalVentas   = ganancias?.reduce((s, r) => s + Number(r.total_ventas), 0) ?? 0
  const margenPct     = totalIngresos > 0 ? (totalGanancia / totalIngresos) * 100 : 0

  const hora = new Date().getHours()
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'

  const PERIODOS: { key: Periodo; label: string }[] = [
    { key: 'hoy',    label: 'Hoy' },
    { key: 'semana', label: 'Semana' },
    { key: 'mes',    label: 'Mes' },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {saludo}, {user?.nombre?.split(' ')[0]}
        </h1>
        <p className="text-gray-500 text-sm mt-1">Lubricentro E' Manuel — Sistema POS</p>
      </div>

      {/* Sección: Rentabilidad de Ventas */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-700">Rentabilidad de Ventas</h2>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {PERIODOS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPeriodo(key)}
              className={cn(
                'px-3 py-1 text-xs rounded-md font-medium transition-colors',
                periodo === key
                  ? 'bg-white shadow text-primary-700'
                  : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="card">
          <p className="text-sm text-gray-500 mb-1">Ingresos por Ventas</p>
          <p className="text-3xl font-bold text-primary-700">
            {loadingGanancias ? '—' : formatCurrency(totalIngresos)}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {loadingGanancias ? '' : `${totalVentas} venta${totalVentas !== 1 ? 's' : ''} emitidas`}
          </p>
        </div>

        <div className="card border-l-4 border-l-green-500">
          <p className="text-sm text-gray-500 mb-1">Ganancia Estimada</p>
          <p className={`text-3xl font-bold ${totalGanancia >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            {loadingGanancias ? '—' : formatCurrency(totalGanancia)}
          </p>
          <p className="text-xs text-gray-400 mt-1">ingresos – costo de productos</p>
        </div>

        <div className="card">
          <p className="text-sm text-gray-500 mb-1">Margen Promedio</p>
          <p className={`text-3xl font-bold ${
            margenPct >= 30 ? 'text-green-700' :
            margenPct >= 10 ? 'text-yellow-600' :
            loadingGanancias ? 'text-gray-900' :
            'text-red-600'
          }`}>
            {loadingGanancias ? '—' : `${margenPct.toFixed(1)}%`}
          </p>
          <p className="text-xs text-gray-400 mt-1">sobre precio de venta</p>
        </div>
      </div>

      {/* Sección: Inventario */}
      <h2 className="text-base font-semibold text-gray-700 mb-3">Inventario</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="card">
          <p className="text-sm text-gray-500 mb-1">Productos activos</p>
          <p className="text-3xl font-bold text-primary-700">
            {valorInventario?.productos ?? '—'}
          </p>
          <p className="text-xs text-gray-400 mt-1">{valorInventario?.unidades ?? '—'} unidades en total</p>
        </div>

        <div className={`card ${(stockBajo ?? 0) > 0 ? 'border-red-200 bg-red-50' : ''}`}>
          <p className="text-sm text-gray-500 mb-1">Stock bajo / agotado</p>
          <p className={`text-3xl font-bold ${(stockBajo ?? 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {stockBajo ?? '—'}
          </p>
          <p className="text-xs text-gray-400 mt-1">productos bajo el mínimo</p>
        </div>

        <div className="card">
          <p className="text-sm text-gray-500 mb-1">Valor de inventario</p>
          <p className="text-3xl font-bold text-primary-700">
            {valorInventario ? formatCurrency(valorInventario.valor) : '—'}
          </p>
          <p className="text-xs text-gray-400 mt-1">precio venta total</p>
        </div>
      </div>

      {/* Accesos rápidos */}
      <h2 className="text-base font-semibold text-gray-700 mb-3">Accesos rápidos</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { to: '/busqueda', label: 'Búsqueda rápida', color: 'bg-blue-600', desc: 'Escanear o buscar' },
          { to: '/productos/nuevo', label: 'Nuevo producto', color: 'bg-green-600', desc: 'Agregar al inventario' },
          { to: '/inventario', label: 'Ver inventario', color: 'bg-purple-600', desc: 'Stock y alertas' },
          { to: '/importacion', label: 'Importar Excel', color: 'bg-orange-500', desc: 'Carga masiva' },
        ].map(({ to, label, color, desc }) => (
          <Link
            key={to}
            to={to}
            className={`${color} text-white rounded-xl p-4 hover:opacity-90 transition-opacity`}
          >
            <p className="font-semibold text-sm">{label}</p>
            <p className="text-xs opacity-75 mt-0.5">{desc}</p>
          </Link>
        ))}
      </div>

      {stockBajo && stockBajo > 0 && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between">
          <div>
            <p className="font-semibold text-red-800 text-sm">
              ⚠️ {stockBajo} producto{stockBajo > 1 ? 's' : ''} con stock bajo
            </p>
            <p className="text-red-600 text-xs mt-0.5">Revisar y reponer para evitar quiebres de stock</p>
          </div>
          <Link
            to="/inventario"
            className="text-sm font-medium text-red-700 hover:text-red-900 underline"
          >
            Ver alertas →
          </Link>
        </div>
      )}
    </div>
  )
}
