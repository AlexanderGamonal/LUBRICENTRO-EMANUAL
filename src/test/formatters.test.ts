import { describe, it, expect, vi, afterEach } from "vitest"
import {
  diasAtrasLima,
  fechaLima,
  formatCurrency,
  formatDate,
  formatStock,
  hoyLima,
  inicioMesLima,
  formatRolUsuario,
  formatMedioPago,
} from "@/shared/utils/formatters"

// El formato es S/\u00a080.00 (non-breaking space entre S/ y el numero)
// Usamos toContain para no depender del separador exacto del SO
describe("formatCurrency", () => {
  it("formatea un numero positivo en soles", () => {
    const result = formatCurrency(80)
    expect(result).toContain("80.00")
    expect(result).toContain("S/")
  })
  it("maneja null sin lanzar y retorna placeholder", () => {
    expect(formatCurrency(null)).toBe("S/ \u2014")
  })
  it("maneja undefined sin lanzar y retorna placeholder", () => {
    expect(formatCurrency(undefined)).toBe("S/ \u2014")
  })
  it("maneja NaN sin lanzar", () => {
    expect(formatCurrency(NaN)).toBe("S/ \u2014")
  })
  it("formatea cero como S/ 0.00", () => {
    const result = formatCurrency(0)
    expect(result).toContain("0.00")
  })
})

describe("formatDate", () => {
  it("no retrocede un dia para fechas en Lima (bug timezone UTC-5)", () => {
    // "2026-06-17" como date-only sin hora se parseaba como UTC midnight
    // lo que en Lima (UTC-5) se convierte en "16/06/2026 a las 7pm"
    const result = formatDate("2026-06-17")
    expect(result).toBe("17/06/2026")
  })
  it("acepta objetos Date", () => {
    const d = new Date("2026-01-15T12:00:00")
    expect(formatDate(d)).toContain("15")
  })
  it("maneja string invalido sin lanzar", () => {
    expect(formatDate("no-es-una-fecha")).toBe("\u2014")
  })
  it("maneja timestamp de Supabase con microsegundos (Android fix)", () => {
    // PostgreSQL devuelve hasta 6 decimales; algunos Android WebViews los rechazan
    const result = formatDate("2026-06-17T14:30:00.123456+00:00")
    expect(result).not.toBe("\u2014")
  })
})

describe("formatStock", () => {
  it("retorna agotado cuando stock es 0", () => {
    expect(formatStock(0, 5).text).toBe("Agotado")
    expect(formatStock(0, 5).color).toContain("red")
  })
  it("retorna bajo cuando stock <= minimo", () => {
    expect(formatStock(3, 5).text).toBe("3 (bajo)")
    expect(formatStock(5, 5).text).toBe("5 (bajo)")
  })
  it("retorna numero cuando stock > minimo", () => {
    expect(formatStock(10, 5).text).toBe("10")
    expect(formatStock(10, 5).color).toContain("green")
  })
})

describe("formatRolUsuario", () => {
  it("traduce roles conocidos", () => {
    expect(formatRolUsuario("admin")).toBe("Administrador")
    expect(formatRolUsuario("vendedor")).toBe("Vendedor")
    expect(formatRolUsuario("almacen")).toBe("Almac\u00e9n")
    expect(formatRolUsuario("superadmin")).toBe("Super Admin")
  })
  it("devuelve el string original para roles desconocidos", () => {
    expect(formatRolUsuario("desconocido")).toBe("desconocido")
  })
})

describe("formatMedioPago", () => {
  it("traduce medios de pago conocidos", () => {
    expect(formatMedioPago("efectivo")).toBe("Efectivo")
    expect(formatMedioPago("yape")).toBe("Yape")
    expect(formatMedioPago("credito")).toBe("Cr\u00e9dito")
    expect(formatMedioPago("mixto")).toBe("Mixto")
  })
  it("retorna el string original para medios desconocidos", () => {
    expect(formatMedioPago("bitcoin")).toBe("bitcoin")
  })
})


describe('fechas en hora de Lima (UTC-5)', () => {
  afterEach(() => vi.useRealTimers())

  it('a las 22:00 en Lima sigue siendo el mismo día (en UTC ya es el siguiente)', () => {
    // 2026-10-03T03:00:00Z = 2026-10-02 22:00 en Lima
    expect(fechaLima(new Date('2026-10-03T03:00:00Z'))).toBe('2026-10-02')
    expect(new Date('2026-10-03T03:00:00Z').toISOString().split('T')[0]).toBe('2026-10-03') // el bug anterior
  })

  it('cambia de día a la medianoche de Lima, no a la de UTC', () => {
    expect(fechaLima(new Date('2026-10-02T04:59:59Z'))).toBe('2026-10-01')
    expect(fechaLima(new Date('2026-10-02T05:00:00Z'))).toBe('2026-10-02')
  })

  it('hoyLima, diasAtrasLima e inicioMesLima parten de la fecha de Lima', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-01T03:30:00Z')) // 28-feb 22:30 en Lima
    expect(hoyLima()).toBe('2026-02-28')
    expect(diasAtrasLima(7)).toBe('2026-02-21')
    expect(inicioMesLima()).toBe('2026-02-01')
  })

  it('diasAtrasLima cruza fin de mes y de año correctamente', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-03T12:00:00Z'))
    expect(diasAtrasLima(7)).toBe('2025-12-27')
  })
})
