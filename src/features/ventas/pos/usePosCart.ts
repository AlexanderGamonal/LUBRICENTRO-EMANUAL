import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { formatCurrency } from '@/shared/utils/formatters'
import type { ItemCarrito, ProductoDetalle } from './constants'

/**
 * Estado y reglas del carrito del POS.
 * `canLowerPrice`: solo admin/superadmin pueden vender por debajo del precio de lista
 * (misma regla que aplica crear_venta en la base de datos).
 */
export function usePosCart(canLowerPrice: boolean) {
  const [carrito, setCarrito] = useState<ItemCarrito[]>([])
  const [descuento, setDescuento] = useState<number>(0)

  const addToCart = useCallback((producto: ProductoDetalle): boolean => {
    if (producto.stock_actual <= 0) {
      toast.error('Sin stock disponible')
      return false
    }
    let added = true
    setCarrito((prev) => {
      const existing = prev.find((i) => i.producto_id === producto.id)
      if (existing) {
        if (existing.cantidad >= producto.stock_actual) {
          toast.warning(`Stock máximo disponible: ${producto.stock_actual}`)
          added = false
          return prev
        }
        return prev.map((i) =>
          i.producto_id === producto.id ? { ...i, cantidad: i.cantidad + 1, subtotal: (i.cantidad + 1) * i.precio_unitario } : i,
        )
      }
      return [
        ...prev,
        {
          producto_id: producto.id,
          nombre: producto.nombre,
          codigo_interno: producto.codigo_interno,
          precio_unitario: producto.precio_venta,
          precio_lista: producto.precio_venta,
          cantidad: 1,
          subtotal: producto.precio_venta,
          stock_disponible: producto.stock_actual,
        },
      ]
    })
    if (added) toast(`+1 ${producto.nombre}`, { id: 'pos-add', duration: 1400 })
    return added
  }, [])

  const changeQuantity = useCallback((productoId: string, qty: number) => {
    setCarrito((prev) =>
      prev.map((i) => {
        if (i.producto_id !== productoId) return i
        const clamped = Math.min(Math.max(1, qty), i.stock_disponible)
        return { ...i, cantidad: clamped, subtotal: clamped * i.precio_unitario }
      }),
    )
  }, [])

  const changePrice = useCallback(
    (productoId: string, price: number) => {
      setCarrito((prev) =>
        prev.map((i) => {
          if (i.producto_id !== productoId) return i
          let nuevo = price
          if (!canLowerPrice && price < i.precio_lista) {
            nuevo = i.precio_lista
            toast.warning(`El precio mínimo es el de lista (${formatCurrency(i.precio_lista)}). Para rebajar usa el descuento.`)
          }
          return { ...i, precio_unitario: nuevo, subtotal: nuevo * i.cantidad }
        }),
      )
    },
    [canLowerPrice],
  )

  const remove = useCallback((productoId: string) => {
    setCarrito((prev) => prev.filter((i) => i.producto_id !== productoId))
  }, [])

  const empty = useCallback(() => {
    setCarrito([])
    setDescuento(0)
  }, [])

  const subtotal = carrito.reduce((s, i) => s + i.subtotal, 0)
  const descuentoClamp = Math.min(Math.max(0, descuento), subtotal)
  const total = Math.max(0, subtotal - descuentoClamp)
  const totalItems = carrito.reduce((s, i) => s + i.cantidad, 0)

  return { carrito, descuento, setDescuento, subtotal, descuentoClamp, total, totalItems, addToCart, changeQuantity, changePrice, remove, empty }
}
