export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(date: string | Date): string {
  try {
    const d = date instanceof Date ? date : new Date(date)
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
    const d = date instanceof Date ? date : new Date(date)
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
