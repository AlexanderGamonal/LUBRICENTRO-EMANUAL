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

  test('fecha opcional: por defecto es hoy; con la casilla se elige otra y se envía al servidor', async ({ page }) => {
    const { rpcCalls } = await mockSupabase(page, 'admin', FIXTURES, { registrar_servicio: { servicio_id: 's-1' } })
    await page.goto('/servicios/nuevo?vehiculo_id=veh-1')
    await page.getByLabel('Descripción del servicio').fill('Cambio de aceite')

    // por defecto: "Hoy", sin campo de fecha
    await expect(page.getByText(/^Hoy,/)).toBeVisible()
    await expect(page.locator('input[type="date"]')).toHaveCount(0)

    // al marcar la casilla aparece el selector, limitado a hoy y a un año atrás
    await page.getByLabel('Registrar con otra fecha').check()
    const campo = page.getByLabel('Fecha del servicio')
    await expect(campo).toBeVisible()
    const max = await campo.getAttribute('max')
    const min = await campo.getAttribute('min')
    expect(max).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(min! < max!).toBe(true)

    // una fecha anterior al mínimo se rechaza en pantalla
    await campo.fill('2001-01-01')
    await expect(page.getByText(/más de un año/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Registrar atención' })).toBeDisabled()

    await campo.fill(min!)
    await page.getByRole('button', { name: 'Registrar atención' }).click()
    await expect(page).toHaveURL(/\/vehiculos\/veh-1$/)
    expect(rpcCalls.find((c) => c.name === 'registrar_servicio')?.body).toMatchObject({ p_fecha_servicio: min })
  })

  test('sin la casilla se envía p_fecha_servicio = null (el servidor usa hoy)', async ({ page }) => {
    const { rpcCalls } = await mockSupabase(page, 'admin', FIXTURES, { registrar_servicio: { servicio_id: 's-1' } })
    await page.goto('/servicios/nuevo?vehiculo_id=veh-1')
    await page.getByLabel('Descripción del servicio').fill('Revisión')
    await page.getByRole('button', { name: 'Registrar atención' }).click()
    await expect(page).toHaveURL(/\/vehiculos\/veh-1$/)
    expect(rpcCalls.find((c) => c.name === 'registrar_servicio')?.body.p_fecha_servicio).toBeNull()
  })

  test('servicio con pago mixto envía el detalle y exige que el reparto cubra el total', async ({ page }) => {
    const { rpcCalls } = await mockSupabase(page, 'admin', FIXTURES, { registrar_servicio: { servicio_id: 's-1' } })
    await page.goto('/servicios/nuevo?vehiculo_id=veh-1')
    await page.getByLabel('Descripción del servicio').fill('Cambio de aceite')
    await page.getByLabel('Mano de obra / servicio (S/)').fill('100')
    await page.getByRole('radio', { name: 'Mixto' }).check({ force: true })

    await page.getByRole('spinbutton', { name: /Monto en Efectivo/ }).fill('60')
    await expect(page.getByText(/Faltan S\/\s40.00/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Registrar atención' })).toBeDisabled()

    await page.getByRole('button', { name: 'Agregar medio' }).click()
    await expect(page.getByRole('spinbutton', { name: /Monto en Yape/ })).toHaveValue('40')
    await page.getByRole('button', { name: 'Registrar atención' }).click()
    await expect(page).toHaveURL(/\/vehiculos\/veh-1$/)

    expect(rpcCalls.find((c) => c.name === 'registrar_servicio')?.body).toMatchObject({
      p_medio_pago: 'mixto',
      p_detalles_pago: [
        { medio: 'efectivo', monto: 60 },
        { medio: 'yape', monto: 40 },
      ],
    })
  })
})
