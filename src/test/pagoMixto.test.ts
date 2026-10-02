import { describe, expect, it } from 'vitest'
import { aDetallesRpc, errorPagoMixto, pagoMixtoInicial, sumaPagos } from '@/features/ventas/pos/pagoMixto'
import type { PagoLinea } from '@/features/ventas/pos/pagoMixto'

const l = (medio: PagoLinea['medio'], monto: number, key: string = medio): PagoLinea => ({ key, medio, monto })

describe('pago mixto (misma regla que validar_detalles_pago en la base)', () => {
  it('empieza con todo el total en efectivo', () => {
    const [unica, ...resto] = pagoMixtoInicial(80)
    expect(resto).toHaveLength(0)
    expect(unica).toMatchObject({ medio: 'efectivo', monto: 80 })
  })

  it('acepta un reparto que suma exactamente el total', () => {
    expect(errorPagoMixto([l('efectivo', 50), l('yape', 30)], 80)).toBeNull()
  })

  it('tolera un centavo de diferencia por redondeo, no más', () => {
    expect(errorPagoMixto([l('efectivo', 79.995)], 80)).toBeNull()
    expect(errorPagoMixto([l('efectivo', 79.9)], 80)).toMatch(/Faltan/)
  })

  it('avisa cuánto falta o cuánto se pasa', () => {
    expect(errorPagoMixto([l('efectivo', 50), l('yape', 20)], 80)).toContain('Faltan')
    expect(errorPagoMixto([l('efectivo', 100)], 80)).toContain('Te pasas')
  })

  it('rechaza montos en cero, medios repetidos y listas vacías', () => {
    expect(errorPagoMixto([l('efectivo', 80), l('yape', 0)], 80)).toMatch(/mayor a cero/)
    expect(errorPagoMixto([l('efectivo', 40, 'a'), l('efectivo', 40, 'b')], 80)).toMatch(/repitas/)
    expect(errorPagoMixto([], 80)).toMatch(/al menos un medio/)
  })

  it('suma sin errores de coma flotante y arma el payload sin claves internas', () => {
    expect(sumaPagos([l('efectivo', 0.1), l('yape', 0.2)])).toBe(0.3)
    expect(aDetallesRpc([l('efectivo', 50.004), l('plin', 29.996)])).toEqual([
      { medio: 'efectivo', monto: 50 },
      { medio: 'plin', monto: 30 },
    ])
  })
})
