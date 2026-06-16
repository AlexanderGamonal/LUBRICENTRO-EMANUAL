import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import { formatCurrency } from '@/shared/utils/formatters'
import { Link } from 'react-router-dom'

export function DashboardPage() {
  const { user } = useAuth()

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
        .select('valor_venta, total_productos, total_unidades')
        .eq('sucursal_id', user!.sucursal_id)
      return {
        valor: (data ?? []).reduce((s, r) => s + Number(r.valor_venta), 0),
        productos: (data ?? []).reduce((s, r) => s + Number(r.total_productos), 0),
        unidades: (data ?? []).reduce((s, r) => s + Number(r.total_unidades), 0),
      }
    },
    enabled: !!user,
  })

  const hora = new Date().getHours()
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {saludo}, {user?.nombre?.split(' ')[0]}
        </h1>
        <p className="text-gray-500 text-sm mt-1">Lubricentro E' Manuel — Sistema POS</p>
      </div>

      {/* Tarjetas métricas */}
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
