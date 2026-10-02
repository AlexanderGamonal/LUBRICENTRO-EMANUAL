import { Banknote, ClipboardList, CreditCard, Landmark, Smartphone } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { MedioPago } from '@/shared/types/database'

export interface ProductoDetalle {
  id: string
  sucursal_id: string
  codigo_interno: string
  codigo_barras: string | null
  nombre: string
  marca: string | null
  viscosidad_especificacion: string | null
  precio_venta: number
  costo: number
  stock_actual: number
  stock_minimo: number
  tiene_codigo_barras: boolean
  foto_url: string | null
  activo: boolean
  categoria_nombre: string | null
  stock_estado: 'ok' | 'bajo' | 'agotado'
}

export interface ItemCarrito {
  producto_id: string
  nombre: string
  codigo_interno: string
  precio_unitario: number
  /** Precio de lista al momento de agregar: piso para vendedores (lo exige crear_venta). */
  precio_lista: number
  cantidad: number
  subtotal: number
  stock_disponible: number
}

export interface CajaRow {
  id: string
  sucursal_id: string
  estado: 'abierta' | 'cerrada'
}

export interface VentaCreada {
  id: string
  total: number
  subtotal: number
  descuento: number
  medio_pago: MedioPago
  cliente_nombre?: string | null
  created_at: string
}

export const MEDIO_PAGO_OPTIONS: { value: MedioPago; label: string; icon: LucideIcon }[] = [
  { value: 'efectivo', label: 'Efectivo', icon: Banknote },
  { value: 'yape', label: 'Yape', icon: Smartphone },
  { value: 'plin', label: 'Plin', icon: Smartphone },
  { value: 'tarjeta', label: 'Tarjeta', icon: CreditCard },
  { value: 'transferencia', label: 'Transferencia', icon: Landmark },
  { value: 'credito', label: 'Crédito', icon: ClipboardList },
]

export const STOCK_BADGE: Record<ProductoDetalle['stock_estado'], { label: string; badgeClass: string; textClass: string }> = {
  ok: { label: 'En stock', badgeClass: 'bg-green-100 text-green-700', textClass: 'text-green-700' },
  bajo: { label: 'Stock bajo', badgeClass: 'bg-yellow-100 text-yellow-700', textClass: 'text-yellow-700' },
  agotado: { label: 'Agotado', badgeClass: 'bg-red-100 text-red-700', textClass: 'text-red-700' },
}

/** Billetes habituales para sugerir "monto recibido" en efectivo. */
export function montosRapidos(total: number): number[] {
  const candidatos = [10, 20, 50, 100, 200].filter((b) => b >= total)
  const redondeo10 = Math.ceil(total / 10) * 10
  const set = new Set<number>()
  if (redondeo10 > total) set.add(redondeo10)
  for (const c of candidatos) {
    if (set.size >= 3) break
    set.add(c)
  }
  return [...set].filter((v) => v > total).sort((a, b) => a - b).slice(0, 3)
}
