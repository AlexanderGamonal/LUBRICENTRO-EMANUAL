import { test, expect } from '@playwright/test'
import { mockSupabase, type MockRol } from './helpers/mockSupabase'
import { FIXTURES } from './fixtures'

async function abrirPos(page: import('@playwright/test').Page, rol: MockRol = 'admin') {
  const mock = await mockSupabase(page, rol, FIXTURES, { crear_venta: { venta_id: 'a1b2c3d4-0000-0000-0000-000000000000' } })
  await page.goto('/ventas/nueva')
  await expect(page.getByRole('searchbox', { name: /buscar producto/i })).toBeVisible()
  return mock
}

test.describe('POS — escritorio', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('agregar producto, cobrar en efectivo y ver comprobante', async ({ page }) => {
    await abrirPos(page)
    await page.getByRole('button', { name: /Agregar Aceite Mobil 1/ }).click()

    const carrito = page.getByRole('region', { name: 'Carrito de venta' })
    await expect(carrito.getByText('S/ 68.50').first()).toBeVisible()
    await carrito.getByRole('button', { name: /Cobrar S\/ 68.50/ }).click()

    const dialogo = page.getByRole('dialog', { name: 'Cobrar' })
    await expect(dialogo).toBeVisible()
    await expect(dialogo.getByRole('radio', { name: 'Efectivo' })).toBeChecked()
    // el foco empieza en "monto recibido"
    await expect(dialogo.getByLabel('Monto recibido (S/)')).toBeFocused()
    await dialogo.getByRole('button', { name: 'S/ 70.00' }).click()
    await expect(dialogo.getByRole('status')).toContainText('S/ 1.50')

    await dialogo.getByRole('button', { name: /Confirmar venta/ }).click()
    const recibo = page.getByRole('dialog', { name: 'Comprobante de venta' })
    await expect(recibo).toBeVisible()
    await expect(recibo).toContainText('#A1B2C3D4')

    await recibo.getByRole('button', { name: 'Nueva venta' }).click()
    await expect(page.getByText('El carrito está vacío')).toBeVisible()
  })

  test('el comprobante imprime solo el recibo (no toda la pantalla)', async ({ page }) => {
    await abrirPos(page)
    await page.getByRole('button', { name: /Agregar Aceite Mobil 1/ }).click()
    await page.getByRole('button', { name: /Cobrar S\/ 68.50/ }).click()
    await page.getByRole('button', { name: /Confirmar venta/ }).click()
    await expect(page.getByRole('dialog', { name: 'Comprobante de venta' })).toBeVisible()

    await page.emulateMedia({ media: 'print' })
    await expect(page.locator('#root')).toBeHidden()
    await expect(page.locator('#receipt-print-root')).toBeVisible()
    await expect(page.locator('#receipt-print-root')).toContainText("Lubricentro E' Manuel")
    await expect(page.getByRole('button', { name: 'Imprimir' })).toBeHidden()
  })

  test('crédito sin cliente bloquea la confirmación', async ({ page }) => {
    await abrirPos(page)
    await page.getByRole('button', { name: /Agregar Aceite Mobil 1/ }).click()
    await page.getByRole('button', { name: /Cobrar S\/ 68.50/ }).click()
    const dialogo = page.getByRole('dialog', { name: 'Cobrar' })
    await dialogo.getByRole('radio', { name: 'Crédito' }).check({ force: true })
    await expect(dialogo.getByRole('alert')).toContainText('Selecciona un cliente')
    await expect(dialogo.getByRole('button', { name: /Confirmar venta/ })).toBeDisabled()
  })

  test('pago mixto: reparte el total entre medios y envía el detalle al servidor', async ({ page }) => {
    const { rpcCalls } = await abrirPos(page)
    await page.getByRole('button', { name: /Agregar Aceite Mobil 1/ }).click()
    await page.getByRole('button', { name: /Cobrar S\/ 68.50/ }).click()

    const dialogo = page.getByRole('dialog', { name: 'Cobrar' })
    await dialogo.getByRole('radio', { name: 'Mixto' }).check({ force: true })

    // arranca con todo en efectivo: ya cubre el total
    await expect(dialogo.getByText('El reparto cubre el total')).toBeVisible()

    // bajar el efectivo deja un faltante y bloquea la confirmación
    await dialogo.getByRole('spinbutton', { name: /Monto en Efectivo/ }).fill('40')
    await expect(dialogo.getByText(/Faltan S\/\s28.50/)).toBeVisible()
    await expect(dialogo.getByRole('button', { name: /Confirmar venta/ })).toBeDisabled()

    // agregar un medio trae automáticamente lo que falta
    await dialogo.getByRole('button', { name: 'Agregar medio' }).click()
    await expect(dialogo.getByRole('spinbutton', { name: /Monto en Yape/ })).toHaveValue('28.5')
    await expect(dialogo.getByText('El reparto cubre el total')).toBeVisible()

    await dialogo.getByRole('button', { name: /Confirmar venta/ }).click()
    await expect(page.getByRole('dialog', { name: 'Comprobante de venta' })).toBeVisible()

    const llamada = rpcCalls.find((c) => c.name === 'crear_venta')
    expect(llamada?.body).toMatchObject({
      p_medio_pago: 'mixto',
      p_detalles_pago: [
        { medio: 'efectivo', monto: 40 },
        { medio: 'yape', monto: 28.5 },
      ],
    })
    // el comprobante muestra el desglose
    const recibo = page.getByRole('dialog', { name: 'Comprobante de venta' })
    await expect(recibo).toContainText('Mixto')
    await expect(recibo).toContainText('Yape')
  })

  test('pago mixto: no permite repetir un medio ni pasarse del total', async ({ page }) => {
    await abrirPos(page)
    await page.getByRole('button', { name: /Agregar Aceite Mobil 1/ }).click()
    await page.getByRole('button', { name: /Cobrar S\/ 68.50/ }).click()
    const dialogo = page.getByRole('dialog', { name: 'Cobrar' })
    await dialogo.getByRole('radio', { name: 'Mixto' }).check({ force: true })
    await dialogo.getByRole('spinbutton', { name: /Monto en Efectivo/ }).fill('90')
    await expect(dialogo.getByText(/Te pasas por S\/\s21.50/)).toBeVisible()
    await expect(dialogo.getByRole('button', { name: /Confirmar venta/ })).toBeDisabled()
  })

  test('el vendedor no puede bajar el precio de lista; el admin sí', async ({ page }) => {
    await abrirPos(page, 'vendedor')
    await page.getByRole('button', { name: /Agregar Aceite Mobil 1/ }).click()
    await page.getByRole('button', { name: /Precio unitario S\/ 68.50/ }).click()
    const campo = page.getByRole('spinbutton', { name: /Precio unitario de/ })
    await campo.fill('10')
    await campo.press('Enter')
    await expect(page.getByText(/precio mínimo es el de lista/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Precio unitario S\/ 68.50/ })).toBeVisible()
  })
})

test.describe('POS — móvil', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test('agregar no cambia de pestaña: aparece la barra con total y "Ver carrito"', async ({ page }) => {
    await abrirPos(page)
    await page.getByRole('button', { name: /Agregar Aceite Mobil 1/ }).click()
    await page.getByRole('button', { name: /Agregar Filtro de aceite/ }).click()

    // sigue en Productos (antes saltaba al carrito en cada toque)
    await expect(page.getByRole('searchbox', { name: /buscar producto/i })).toBeVisible()
    const barra = page.getByRole('button', { name: /Ver carrito: 2 ítems, total S\/ 110.50/ })
    await expect(barra).toBeVisible()

    await barra.click()
    await expect(page.getByRole('region', { name: 'Carrito de venta' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Cobrar S\/ 110.50/ })).toBeVisible()
  })
})
