import { test, expect } from '@playwright/test'
import { mockSupabase } from './helpers/mockSupabase'
import { FIXTURES } from './fixtures'

test.describe('Nueva atención', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('registra la atención enviando el medio de pago elegido', async ({ page }) => {
    const { rpcCalls } = await mockSupabase(page, 'admin', FIXTURES, {
      registrar_servicio: { servicio_id: 's-1', total: 98.5 },
    })
    await page.goto('/servicios/nuevo?vehiculo_id=veh-1')
    await expect(page.getByText('ABC-123').first()).toBeVisible()

    await page.getByLabel('Descripción del servicio').fill('Cambio de aceite y filtro')

    // buscador de productos accesible (combobox)
    const buscador = page.getByRole('combobox', { name: 'Buscar producto' })
    await buscador.fill('aceite')
    await page.getByRole('option', { name: /Aceite Mobil 1/ }).click()
    await expect(page.getByRole('list', { name: 'Productos agregados' })).toContainText('Aceite Mobil 1')

    await page.getByLabel('Mano de obra / servicio (S/)').fill('30')
    await page.getByRole('radio', { name: 'Yape' }).check({ force: true })
    await expect(page.locator('dd', { hasText: 'S/ 98.50' })).toBeVisible()

    await page.getByRole('button', { name: 'Registrar atención' }).click()
    await expect(page).toHaveURL(/\/vehiculos\/veh-1$/)

    const llamada = rpcCalls.find((c) => c.name === 'registrar_servicio')
    expect(llamada?.body).toMatchObject({
      p_vehiculo_id: 'veh-1',
      p_descripcion: 'Cambio de aceite y filtro',
      p_medio_pago: 'yape',
      p_monto_servicio: 30,
    })
    expect(llamada?.body.p_items).toHaveLength(1)
  })

  test('no deja registrar a crédito si el vehículo no tiene cliente', async ({ page }) => {
    const sinCliente = { ...(FIXTURES.vehiculos[0] as object), clientes: null, cliente_id: null }
    await mockSupabase(page, 'admin', { ...FIXTURES, vehiculos: [sinCliente] })
    await page.goto('/servicios/nuevo?vehiculo_id=veh-1')
    await page.getByLabel('Descripción del servicio').fill('Revisión general')
    await page.getByRole('radio', { name: 'Crédito' }).check({ force: true })
    await expect(page.getByRole('alert').filter({ hasText: 'necesita un cliente' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Registrar atención' })).toBeDisabled()
  })

  test('la fecha se muestra como "Hoy" y no es editable (el servidor registra hoy)', async ({ page }) => {
    await mockSupabase(page, 'admin', FIXTURES)
    await page.goto('/servicios/nuevo?vehiculo_id=veh-1')
    await expect(page.getByText(/^Hoy,/)).toBeVisible()
    await expect(page.locator('input[type="date"]')).toHaveCount(0)
  })
})
