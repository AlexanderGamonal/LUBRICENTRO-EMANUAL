export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return 'S/ —'
  const n = Number(amount)
  if (isNaN(n)) return 'S/ —'
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
  }).format(n)
}

// Date-only strings like '2026-06-17' are parsed as UTC midnight by JS.
// In Lima (UTC-5) that becomes the previous day at 7pm, showing the wrong date.
// Fix: treat date-only strings as local noon so no timezone shift occurs.
// PostgreSQL also returns timestamps with microseconds (6 decimal digits) that
// some Android WebViews reject as Invalid Date — normalize to milliseconds (3 digits).
function parseDate(date: string | Date): Date {
  if (date instanceof Date) return date
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return new Date(date + 'T12:00:00')
  return new Date(date.replace(/(\.\d{3})\d+/, '$1'))
}

export function formatDate(date: string | Date): string {
  try {
    const d = parseDate(date)
    if (isNaN(d.getTime())) return '—'
    return new Intl.DateTimeFormat('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d)
  } catch {
    return '—'
  }
}

export function formatDateTime(date: string | Date): string {
  try {
    const d = parseDate(date)
    if (isNaN(d.getTime())) return '—'
    return new Intl.DateTimeFormat('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)
  } catch {
    return '—'
  }
}

export function formatStock(stock: number, minimo: number): { text: string; color: string } {
  if (stock === 0) return { text: 'Agotado', color: 'text-red-600' }
  if (stock <= minimo) return { text: `${stock} (bajo)`, color: 'text-yellow-600' }
  return { text: String(stock), color: 'text-green-600' }
}

export function formatRolUsuario(rol: string): string {
  const map: Record<string, string> = {
    superadmin: 'Super Admin',
    admin: 'Administrador',
    vendedor: 'Vendedor',
    almacen: 'Almacén',
  }
  return map[rol] ?? rol
}

export function formatMedioPago(medio: string): string {
  const map: Record<string, string> = {
    efectivo: 'Efectivo',
    yape: 'Yape',
    plin: 'Plin',
    tarjeta: 'Tarjeta',
    transferencia: 'Transferencia',
    credito: 'Crédito',
    mixto: 'Mixto',
  }
  return map[medio] ?? medio
}

/* ── Fechas en hora de Lima ───────────────────────────────────────────────
 * `new Date().toISOString().split('T')[0]` devuelve la fecha en UTC: en Lima
 * (UTC-5) después de las 7 pm ya es "mañana". Estas funciones calculan siempre
 * con la zona America/Lima, sin depender de la zona del dispositivo.
 */
const LIMA_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Lima',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Fecha (YYYY-MM-DD) de un instante, vista desde Lima. */
export function fechaLima(d: Date = new Date()): string {
  return LIMA_DATE.format(d)
}

/** Hoy en Lima (YYYY-MM-DD). */
export function hoyLima(): string {
  return fechaLima()
}

/** Fecha en Lima de hace `n` días (YYYY-MM-DD). */
export function diasAtrasLima(n: number): string {
  const [y, m, d] = hoyLima().split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d - n)).toISOString().slice(0, 10)
}

/** Primer día del mes actual en Lima (YYYY-MM-01). */
export function inicioMesLima(): string {
  return `${hoyLima().slice(0, 7)}-01`
}

/** Hora (0-23) actual en Lima. */
export function horaLima(d: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'America/Lima' }).format(d))
}

/** "jueves 2 de octubre" en hora de Lima. */
export function fechaLargaLima(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Lima' }).format(d)
}
