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
import { CircleCheck } from 'lucide-react'
import { Button, EmptyState, Field, FormActions, PageHeader } from '@/shared/ui'
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
      <div className="mx-auto max-w-2xl p-4 sm:p-6">
        <div className="card">
          <EmptyState
            title="Producto no encontrado"
            description="Puede que haya sido desactivado o que no pertenezca a esta sucursal."
            action={
              <Button variant="secondary" onClick={() => navigate('/inventario')}>
                Volver al inventario
              </Button>
            }
          />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <PageHeader back title="Ajuste de stock" />

      <section className="card mb-5 p-4 sm:p-6" aria-label="Producto a ajustar">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-fg">{producto.nombre}</h2>
            {producto.marca && <p className="text-sm text-fg-muted">{producto.marca}</p>}
            <p className="mt-1 font-mono text-xs text-fg-subtle">{producto.codigo_interno}</p>
          </div>
          {producto.ubicacion_codigo && (
            <span className="flex-shrink-0 rounded bg-blue-50 px-2 py-1 font-mono text-xs text-primary-700">{producto.ubicacion_codigo}</span>
          )}
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4 sm:gap-4">
          <div>
            <dt className="text-xs text-fg-muted">Stock actual</dt>
            <dd
              className={cn(
                'mt-0.5 text-2xl font-bold',
                producto.stock_actual === 0 ? 'text-red-700' : producto.stock_actual <= producto.stock_minimo ? 'text-yellow-700' : 'text-green-700',
              )}
            >
              {producto.stock_actual}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-fg-muted">Stock mínimo</dt>
            <dd className="mt-0.5 text-2xl font-bold text-fg">{producto.stock_minimo}</dd>
          </div>
          <div>
            <dt className="text-xs text-fg-muted">Precio venta</dt>
            <dd className="mt-0.5 text-lg font-bold text-fg sm:text-2xl">{formatCurrency(producto.precio_venta)}</dd>
          </div>
        </dl>
      </section>

      {resultado && (
        <div role="status" className="card mb-5 border border-green-200 bg-green-50 p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
              <CircleCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="font-semibold text-green-800">Stock ajustado exitosamente</p>
              <p className="text-sm text-green-700">
                Stock anterior: <span className="font-bold">{resultado.stock_anterior}</span>
                {' → '}
                Stock nuevo: <span className="font-bold">{resultado.stock_nuevo}</span>
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <Button className="flex-1" onClick={() => navigate('/inventario')}>
              Ver inventario
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => setResultado(null)}>
              Otro ajuste
            </Button>
          </div>
        </div>
      )}

      {!resultado && (
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="card space-y-5 p-4 sm:p-6">
            <h2 className="text-base font-semibold text-fg">Ingresar ajuste</h2>

            <Field label="Nuevo stock" required error={errors.nuevo_stock?.message} hint={`Stock actual: ${producto.stock_actual}`} className="sm:max-w-xs">
              {(p) => (
                <input
                  {...p}
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  {...register('nuevo_stock', { valueAsNumber: true })}
                  className="input-field"
                  placeholder={String(producto.stock_actual)}
                />
              )}
            </Field>

            <Field label="Motivo del ajuste" required error={errors.motivo?.message}>
              {(p) => (
                <textarea
                  {...p}
                  {...register('motivo')}
                  rows={3}
                  className="input-field resize-none"
                  placeholder="Describe el motivo del ajuste (mínimo 10 caracteres)..."
                />
              )}
            </Field>
          </div>

          <FormActions align="end">
            <Button variant="secondary" onClick={() => navigate('/inventario')} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {isSubmitting ? 'Ajustando…' : 'Confirmar ajuste'}
            </Button>
          </FormActions>
        </form>
      )}
    </div>
  )
}
