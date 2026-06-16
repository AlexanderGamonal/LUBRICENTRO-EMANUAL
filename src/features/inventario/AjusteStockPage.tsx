import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import { formatCurrency } from '@/shared/utils/formatters'
import { cn } from '@/shared/utils/cn'
import type { Database } from '@/shared/types/database'

type ProductoDetalle = Database['public']['Views']['vw_productos_detalle']['Row']

const ajusteSchema = z.object({
  nuevo_stock: z
    .number({ invalid_type_error: 'Ingresa un número válido' })
    .int('El stock debe ser un número entero')
    .min(0, 'El stock no puede ser negativo'),
  motivo: z
    .string()
    .min(10, 'El motivo debe tener al menos 10 caracteres')
    .max(500, 'El motivo no puede superar 500 caracteres'),
})

type AjusteFormData = z.infer<typeof ajusteSchema>

interface AjusteResultado {
  stock_anterior: number
  stock_nuevo: number
}

export function AjusteStockPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [resultado, setResultado] = useState<AjusteResultado | null>(null)

  const { data: producto, isLoading } = useQuery<ProductoDetalle>({
    queryKey: ['producto-ajuste', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vw_productos_detalle')
        .select('*')
        .eq('id', id!)
        .eq('sucursal_id', user!.sucursal_id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id && !!user,
  })

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AjusteFormData>({
    resolver: zodResolver(ajusteSchema),
    defaultValues: {
      nuevo_stock: producto?.stock_actual ?? 0,
      motivo: '',
    },
  })

  const onSubmit = async (data: AjusteFormData) => {
    if (!id) return
    try {
      const { data: res, error } = await supabase.rpc('ajustar_stock', {
        p_producto_id: id,
        p_stock_nuevo: data.nuevo_stock,
        p_motivo: data.motivo,
      })
      if (error) throw error

      const resJson = res as { stock_anterior: number; stock_nuevo: number }
      setResultado({
        stock_anterior: resJson.stock_anterior,
        stock_nuevo: resJson.stock_nuevo,
      })
      toast.success('Stock ajustado exitosamente')
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Error al ajustar el stock',
      )
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        {[1, 2, 3].map((n) => (
          <div key={n} className="h-16 bg-gray-200 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (!producto) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="card text-center py-12">
          <p className="text-gray-500">Producto no encontrado</p>
          <button
            onClick={() => navigate('/inventario')}
            className="btn-secondary mt-4"
          >
            Volver al Inventario
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Ajuste de Stock</h1>
        <button
          onClick={() => navigate('/inventario')}
          className="btn-secondary"
        >
          Volver
        </button>
      </div>

      {/* Tarjeta del producto */}
      <div className="card mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {producto.nombre}
            </h2>
            {producto.marca && (
              <p className="text-sm text-gray-500">{producto.marca}</p>
            )}
            <p className="text-xs text-gray-400 font-mono mt-1">
              {producto.codigo_interno}
            </p>
          </div>
          {producto.ubicacion_codigo && (
            <span className="font-mono text-xs bg-blue-50 text-primary-700 px-2 py-1 rounded">
              {producto.ubicacion_codigo}
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-500">Stock Actual</p>
            <p
              className={cn(
                'text-2xl font-bold mt-0.5',
                producto.stock_actual === 0
                  ? 'text-red-600'
                  : producto.stock_actual <= producto.stock_minimo
                  ? 'text-yellow-600'
                  : 'text-green-600',
              )}
            >
              {producto.stock_actual}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Stock Mínimo</p>
            <p className="text-2xl font-bold text-gray-900 mt-0.5">
              {producto.stock_minimo}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Precio Venta</p>
            <p className="text-2xl font-bold text-gray-900 mt-0.5">
              {formatCurrency(producto.precio_venta)}
            </p>
          </div>
        </div>
      </div>

      {/* Resultado del ajuste */}
      {resultado && (
        <div className="card bg-green-50 border border-green-200 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <svg
                className="w-5 h-5 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-green-800">
                Stock ajustado exitosamente
              </p>
              <p className="text-sm text-green-700">
                Stock anterior:{' '}
                <span className="font-bold">{resultado.stock_anterior}</span>
                {' → '}
                Stock nuevo:{' '}
                <span className="font-bold">{resultado.stock_nuevo}</span>
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => navigate('/inventario')}
              className="btn-primary flex-1"
            >
              Ver Inventario
            </button>
            <button
              onClick={() => setResultado(null)}
              className="btn-secondary flex-1"
            >
              Otro Ajuste
            </button>
          </div>
        </div>
      )}

      {/* Formulario */}
      {!resultado && (
        <form onSubmit={handleSubmit(onSubmit)} className="card space-y-5">
          <h2 className="text-base font-semibold text-gray-800">
            Ingresar Ajuste
          </h2>

          <div>
            <label className="label-text">Nuevo Stock *</label>
            <input
              type="number"
              min="0"
              step="1"
              {...register('nuevo_stock', { valueAsNumber: true })}
              className="input-field max-w-xs"
              placeholder={String(producto.stock_actual)}
            />
            {errors.nuevo_stock && (
              <p className="error-text">{errors.nuevo_stock.message}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              Stock actual: {producto.stock_actual}
            </p>
          </div>

          <div>
            <label className="label-text">Motivo del Ajuste *</label>
            <textarea
              {...register('motivo')}
              rows={3}
              className="input-field resize-none"
              placeholder="Describe el motivo del ajuste (mínimo 10 caracteres)..."
            />
            {errors.motivo && (
              <p className="error-text">{errors.motivo.message}</p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/inventario')}
              className="btn-secondary flex-1"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary flex-1"
            >
              {isSubmitting ? 'Ajustando...' : 'Confirmar Ajuste'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
