import { formatCurrency } from '@/shared/utils/formatters'
import type { MedioPago } from '@/shared/types/database'

/** Medios que se pueden combinar (el servidor rechaza crédito y mixto dentro de un mixto). */
export type MedioMixto = Exclude<MedioPago, 'credito' | 'mixto'>

export const MEDIOS_MIXTO: { value: MedioMixto; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'yape', label: 'Yape' },
  { value: 'plin', label: 'Plin' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'transferencia', label: 'Transferencia' },
]

export interface PagoLinea {
  /** Identificador estable de la fila (no va al servidor). */
  key: string
  medio: MedioMixto
  monto: number
}

let seq = 0
export const nuevaKey = () => `pago-${++seq}`
export const redondear = (n: number) => Math.round(n * 100) / 100

/** Punto de partida: todo el total en efectivo, para repartir desde ahí. */
export function pagoMixtoInicial(total: number): PagoLinea[] {
  return [{ key: nuevaKey(), medio: 'efectivo', monto: redondear(total) }]
}

export function sumaPagos(lineas: PagoLinea[]): number {
  return redondear(lineas.reduce((s, l) => s + (Number(l.monto) || 0), 0))
}

/**
 * Misma regla que `validar_detalles_pago` en la base de datos: montos > 0, medios sin repetir y
 * suma exactamente igual al total (tolerancia de un centavo).
 */
export function errorPagoMixto(lineas: PagoLinea[], total: number): string | null {
  if (lineas.length === 0) return 'Agrega al menos un medio de pago.'
  if (lineas.some((l) => !(l.monto > 0))) return 'Cada medio debe tener un monto mayor a cero.'
  if (new Set(lineas.map((l) => l.medio)).size !== lineas.length) return 'No repitas el mismo medio de pago.'
  const resto = redondear(total - sumaPagos(lineas))
  if (Math.abs(resto) > 0.01) return resto > 0 ? `Faltan ${formatCurrency(resto)} por asignar.` : `Te pasas por ${formatCurrency(-resto)}.`
  return null
}

/** Formato que espera el parámetro `p_detalles_pago` de las funciones SQL. */
export function aDetallesRpc(lineas: PagoLinea[]): { medio: MedioMixto; monto: number }[] {
  return lineas.map((l) => ({ medio: l.medio, monto: redondear(l.monto) }))
}

