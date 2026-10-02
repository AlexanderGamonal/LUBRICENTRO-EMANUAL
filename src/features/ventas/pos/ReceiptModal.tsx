import { CircleCheck, Printer, ShoppingCart } from 'lucide-react'
import { Button, Modal } from '@/shared/ui'
import { formatCurrency, formatDateTime } from '@/shared/utils/formatters'
import { MEDIO_PAGO_OPTIONS } from './constants'
import type { ItemCarrito, VentaCreada } from './constants'

interface ReceiptModalProps {
  venta: VentaCreada
  items: ItemCarrito[]
  vendedorNombre: string
  onNuevaVenta: () => void
}

/** Comprobante de la venta recién registrada. No se cierra hasta elegir "Nueva venta". Imprimible. */
export function ReceiptModal({ venta, items, vendedorNombre, onNuevaVenta }: ReceiptModalProps) {
  const medio = MEDIO_PAGO_OPTIONS.find((m) => m.value === venta.medio_pago)

  return (
    <Modal
      open
      onOpenChange={() => undefined}
      persistent
      title="Comprobante de venta"
      description={`Venta #${venta.id.slice(0, 8).toUpperCase()}`}
      hideTitle
      footer={
        <>
          <Button variant="secondary" onClick={() => window.print()} className="no-print">
            <Printer className="h-4 w-4" aria-hidden="true" />
            Imprimir
          </Button>
          <Button onClick={onNuevaVenta} className="no-print">
            <ShoppingCart className="h-4 w-4" aria-hidden="true" />
            Nueva venta
          </Button>
        </>
      }
    >
      <div id="receipt-print-root">
        <div className="mb-5 border-b border-dashed border-line pb-4 text-center">
          <div
            className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full text-white"
            style={{ background: 'linear-gradient(135deg, #1F3864, #0ea5e9)' }}
          >
            <CircleCheck className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-bold text-primary-700">Lubricentro E&apos; Manuel</h2>
          <p className="text-sm text-fg-muted">Comprobante de venta</p>
        </div>

        <dl className="mb-5 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-fg-muted">Nro. de venta</dt>
            <dd className="font-mono font-semibold text-fg">#{venta.id.slice(0, 8).toUpperCase()}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-fg-muted">Fecha y hora</dt>
            <dd className="text-fg">{formatDateTime(venta.created_at)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-fg-muted">Vendedor</dt>
            <dd className="text-fg">{vendedorNombre}</dd>
          </div>
          {venta.cliente_nombre && (
            <div className="flex justify-between">
              <dt className="text-fg-muted">Cliente</dt>
              <dd className="font-medium text-fg">{venta.cliente_nombre}</dd>
            </div>
          )}
        </dl>

        <div className="mb-4 border-t border-dashed border-line pt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase text-fg-muted">
                <th scope="col" className="pb-2 text-left font-medium">Producto</th>
                <th scope="col" className="pb-2 text-center font-medium">Cant.</th>
                <th scope="col" className="pb-2 text-right font-medium">Precio</th>
                <th scope="col" className="pb-2 text-right font-medium">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((item) => (
                <tr key={item.producto_id}>
                  <td className="py-1.5">
                    <p className="font-medium leading-tight text-fg">{item.nombre}</p>
                    <p className="font-mono text-xs text-fg-subtle">{item.codigo_interno}</p>
                  </td>
                  <td className="py-1.5 text-center text-fg-muted">{item.cantidad}</td>
                  <td className="py-1.5 text-right text-fg-muted">{formatCurrency(item.precio_unitario)}</td>
                  <td className="py-1.5 text-right font-semibold text-fg">{formatCurrency(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="mb-4 space-y-1.5 border-t border-dashed border-line pt-4 text-sm">
          <div className="flex justify-between text-fg-muted">
            <dt>Subtotal</dt>
            <dd>{formatCurrency(venta.subtotal)}</dd>
          </div>
          {venta.descuento > 0 && (
            <div className="flex justify-between text-orange-700">
              <dt>Descuento</dt>
              <dd>-{formatCurrency(venta.descuento)}</dd>
            </div>
          )}
          <div className="mt-2 flex justify-between border-t border-line pt-2 text-lg font-bold text-primary-700">
            <dt>TOTAL</dt>
            <dd>{formatCurrency(venta.total)}</dd>
          </div>
          <div className="flex justify-between pt-1 text-xs text-fg-muted">
            <dt>Medio de pago</dt>
            <dd>{medio?.label}</dd>
          </div>
          {venta.detalles_pago?.map((d) => (
            <div key={d.medio} className="flex justify-between pl-3 text-xs text-fg-muted">
              <dt>{MEDIO_PAGO_OPTIONS.find((m) => m.value === d.medio)?.label ?? d.medio}</dt>
              <dd>{formatCurrency(d.monto)}</dd>
            </div>
          ))}
        </dl>

        <p className="border-t border-dashed border-line pt-3 text-center text-xs text-fg-muted">¡Gracias por su compra!</p>
      </div>
    </Modal>
  )
}
