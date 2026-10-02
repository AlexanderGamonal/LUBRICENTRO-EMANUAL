import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, CircleCheck } from 'lucide-react'
import { supabase } from '@/shared/lib/supabase'
import { Button, Field, Modal, RadioCardGroup } from '@/shared/ui'
import { cn } from '@/shared/utils/cn'
import { formatCurrency } from '@/shared/utils/formatters'
import type { MedioPago } from '@/shared/types/database'
import { MEDIO_PAGO_OPTIONS, montosRapidos } from './constants'
import type { ItemCarrito, VentaCreada } from './constants'

interface PaymentModalProps {
  total: number
  subtotal: number
  descuento: number
  items: ItemCarrito[]
  clienteId: string | null
  clienteNombre: string | null
  onClose: () => void
  onSuccess: (venta: VentaCreada) => void
}

export function PaymentModal({ total, subtotal, descuento, items, clienteId, clienteNombre, onClose, onSuccess }: PaymentModalProps) {
  const [medioPago, setMedioPago] = useState<MedioPago>('efectivo')
  const [montoRecibido, setMontoRecibido] = useState<number>(total)
  const [observaciones, setObservaciones] = useState('')
  const [loading, setLoading] = useState(false)
  const montoRef = useRef<HTMLInputElement>(null)

  const vuelto = montoRecibido - total
  const isEfectivo = medioPago === 'efectivo'
  const isCredito = medioPago === 'credito'
  const creditoSinCliente = isCredito && !clienteId
  const canConfirm = !loading && !creditoSinCliente && (!isEfectivo || montoRecibido >= total)

  async function handleConfirmar(e?: React.FormEvent) {
    e?.preventDefault()
    if (!canConfirm) return
    setLoading(true)
    try {
      const p_items = items.map((item) => ({
        producto_id: item.producto_id,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
      }))

      const { data, error } = await supabase.rpc('crear_venta', {
        p_items,
        p_medio_pago: medioPago,
        p_cliente_id: clienteId ?? null,
        p_descuento: descuento,
        p_observaciones: observaciones.trim() || null,
      })

      if (error) throw error

      const result = data as Record<string, unknown>
      const ventaId = (result?.venta_id ?? result?.id ?? '') as string

      onSuccess({
        id: ventaId,
        total,
        subtotal,
        descuento,
        medio_pago: medioPago,
        cliente_nombre: clienteNombre,
        created_at: new Date().toISOString(),
      })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al registrar la venta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open
      onOpenChange={(open) => !open && !loading && onClose()}
      title="Cobrar"
      description={`Total a cobrar: ${formatCurrency(total)}`}
      persistent={loading}
      // En efectivo el cajero escribe el monto recibido: el foco empieza ahí.
      onOpenAutoFocus={(e) => {
        if (montoRef.current) {
          e.preventDefault()
          montoRef.current.focus()
          montoRef.current.select()
        }
      }}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" form="pago-venta-form" size="lg" loading={loading} disabled={!canConfirm}>
            {loading ? 'Registrando venta…' : `Confirmar venta — ${formatCurrency(total)}`}
          </Button>
        </>
      }
    >
      <form id="pago-venta-form" onSubmit={handleConfirmar} className="space-y-5">
        <p className="font-display text-3xl font-bold tabular-nums text-primary-700" aria-hidden="true">
          {formatCurrency(total)}
        </p>

        <RadioCardGroup
          layout="grid"
          legend="Método de pago"
          value={medioPago}
          onChange={setMedioPago}
          options={MEDIO_PAGO_OPTIONS.map((o) => ({ value: o.value, label: o.label, icon: o.icon }))}
        />

        {isEfectivo && (
          <div className="space-y-3 rounded-xl bg-muted p-4">
            <Field label="Monto recibido (S/)">
              {(p) => (
                <input
                  {...p}
                  ref={montoRef}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.1}
                  value={montoRecibido}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setMontoRecibido(parseFloat(e.target.value) || 0)}
                  className="input-field text-lg font-semibold"
                />
              )}
            </Field>

            <div className="flex flex-wrap gap-2" role="group" aria-label="Montos rápidos">
              <button
                type="button"
                onClick={() => setMontoRecibido(total)}
                className={cn(
                  'min-h-touch rounded-full border px-3.5 py-1 text-sm font-semibold transition-colors md:min-h-0',
                  montoRecibido === total ? 'border-primary-700 bg-primary-700 text-white' : 'border-line bg-card text-fg-muted hover:border-primary-700',
                )}
              >
                Exacto
              </button>
              {montosRapidos(total).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMontoRecibido(m)}
                  className={cn(
                    'min-h-touch rounded-full border px-3.5 py-1 text-sm font-semibold transition-colors md:min-h-0',
                    montoRecibido === m ? 'border-primary-700 bg-primary-700 text-white' : 'border-line bg-card text-fg-muted hover:border-primary-700',
                  )}
                >
                  {formatCurrency(m)}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between" role="status" aria-live="polite">
              <span className="text-sm font-medium text-fg-muted">Vuelto</span>
              <span className={cn('text-xl font-bold tabular-nums', vuelto >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300')}>
                {formatCurrency(Math.max(0, vuelto))}
              </span>
            </div>
            {vuelto < 0 && <p className="text-xs font-medium text-red-700 dark:text-red-300">Monto insuficiente — faltan {formatCurrency(Math.abs(vuelto))}</p>}
          </div>
        )}

        {isCredito && (
          <div
            role={creditoSinCliente ? 'alert' : 'status'}
            className={cn('flex items-start gap-2 rounded-xl border p-4', creditoSinCliente ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50')}
          >
            {creditoSinCliente ? (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" aria-hidden="true" />
            ) : (
              <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-green-700" aria-hidden="true" />
            )}
            <p className={cn('text-sm font-medium', creditoSinCliente ? 'text-red-700' : 'text-green-700')}>
              {creditoSinCliente ? 'Selecciona un cliente en el carrito para continuar con crédito.' : <>Crédito para: <strong>{clienteNombre}</strong></>}
            </p>
          </div>
        )}

        <Field label="Observaciones (opcional)">
          {(p) => (
            <textarea
              {...p}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="input-field resize-none"
              rows={2}
              placeholder="Notas adicionales para esta venta..."
            />
          )}
        </Field>

        <dl className="space-y-1.5 rounded-xl bg-primary-700/5 p-4 text-sm">
          <div className="flex justify-between text-fg-muted">
            <dt>Subtotal</dt>
            <dd>{formatCurrency(subtotal)}</dd>
          </div>
          {descuento > 0 && (
            <div className="flex justify-between text-orange-700 dark:text-orange-300">
              <dt>Descuento</dt>
              <dd>-{formatCurrency(descuento)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-primary-700/20 pt-1.5 text-base font-bold text-primary-700">
            <dt>TOTAL A COBRAR</dt>
            <dd>{formatCurrency(total)}</dd>
          </div>
        </dl>
      </form>
    </Modal>
  )
}
