import { test, expect } from '@playwright/test'
import { mockSupabase } from './helpers/mockSupabase'
import { FIXTURES } from './fixtures'

/** Navega y espera a que la app termine de cargar la sesión (el layout ya está montado). */
async function ir(page: import('@playwright/test').Page, ruta: string) {
  await page.goto(ruta)
  await page.locator('#contenido').waitFor()
}

test.describe('Navegación — escritorio', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('el menú se colapsa y recuerda la preferencia al recargar', async ({ page }) => {
    await mockSupabase(page, 'admin', FIXTURES)
    await ir(page, '/')
    const menu = page.getByRole('navigation', { name: 'Navegación principal' })
    await expect(menu.getByText('Operación')).toBeVisible()

    await page.getByRole('button', { name: 'Contraer menú' }).click()
    await expect(menu.getByText('Operación')).toBeHidden()
    // en modo compacto los destinos siguen siendo accesibles por nombre
    await expect(menu.getByRole('link', { name: 'Caja' })).toBeVisible()

    await page.reload()
    await page.locator('#contenido').waitFor()
    await expect(page.getByRole('button', { name: 'Expandir menú' }).first()).toBeVisible()
    await page.getByRole('button', { name: 'Expandir menú' }).first().click()
    await expect(menu.getByText('Operación')).toBeVisible()
  })

  test('"Nueva venta" no resalta "Ventas" (historial) y viceversa', async ({ page }) => {
    await mockSupabase(page, 'admin', FIXTURES)
    await ir(page, '/ventas/nueva')
    const menu = page.getByRole('navigation', { name: 'Navegación principal' })
    await expect(menu.getByRole('link', { name: 'Ventas', exact: true })).not.toHaveAttribute('aria-current', 'page')

    await ir(page, '/ventas')
    await expect(menu.getByRole('link', { name: 'Ventas', exact: true })).toHaveAttribute('aria-current', 'page')
  })

  test('el vendedor no ve "Importar"; el almacén sí', async ({ page }) => {
    await mockSupabase(page, 'vendedor', FIXTURES)
    await ir(page, '/')
    await expect(page.getByRole('link', { name: 'Productos' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Importar' })).toHaveCount(0)
  })

  test('Ctrl+K abre el buscador, filtra pantallas y navega con Enter', async ({ page }) => {
    await mockSupabase(page, 'admin', FIXTURES)
    await ir(page, '/')
    await page.keyboard.press('Control+k')
    const dialogo = page.getByRole('dialog', { name: 'Buscador global' })
    await expect(dialogo).toBeVisible()

    await dialogo.getByRole('combobox').fill('cred')
    await expect(dialogo.getByRole('option', { name: /Créditos/ })).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/creditos$/)
    await expect(dialogo).toBeHidden()
  })

  test('el buscador encuentra productos y abre el listado ya filtrado', async ({ page }) => {
    await mockSupabase(page, 'admin', FIXTURES)
    await ir(page, '/')
    await page.keyboard.press('Control+k')
    await page.getByRole('combobox').fill('mobil')
    await page.getByRole('option', { name: /Aceite Mobil 1/ }).click()
    await expect(page).toHaveURL(/\/productos\?q=LUB-001/)
    await expect(page.getByRole('searchbox', { name: 'Buscar productos' })).toHaveValue('LUB-001')
  })

  test('modo oscuro: se aplica, se recuerda y no parpadea al recargar', async ({ page }) => {
    await mockSupabase(page, 'admin', FIXTURES)
    await ir(page, '/')
    await page.getByRole('button', { name: 'Cambiar a modo oscuro' }).first().click()
    await expect(page.locator('html')).toHaveClass(/dark/)

    await page.reload()
    await page.locator('#contenido').waitFor()
    await expect(page.locator('html')).toHaveClass(/dark/)
    await expect(page.getByRole('button', { name: 'Cambiar a modo claro' }).first()).toBeVisible()
  })

  test('hay un enlace "Saltar al contenido" que lleva al contenido principal', async ({ page }) => {
    await mockSupabase(page, 'admin', FIXTURES)
    await ir(page, '/')
    await page.keyboard.press('Tab')
    const salto = page.getByRole('link', { name: 'Saltar al contenido' })
    await expect(salto).toBeFocused()
    await salto.press('Enter')
    await expect(page.locator('#contenido')).toBeFocused()
  })
})

test.describe('Navegación — móvil', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test('la hoja "Más" filtra por rol y se cierra al navegar', async ({ page }) => {
    await mockSupabase(page, 'vendedor', FIXTURES)
    await ir(page, '/')
    await page.getByRole('button', { name: 'Más' }).click()
    const hoja = page.getByRole('dialog', { name: 'Menú' })
    await expect(hoja).toBeVisible()
    await expect(hoja.getByRole('link', { name: 'Importar' })).toHaveCount(0)

    await hoja.getByRole('link', { name: 'Clientes' }).click()
    await expect(page).toHaveURL(/\/clientes$/)
    await expect(hoja).toBeHidden()
  })

  test('la barra superior móvil muestra el título de la pantalla', async ({ page }) => {
    await mockSupabase(page, 'admin', FIXTURES)
    await ir(page, '/caja')
    await expect(page.locator('header:visible', { hasText: 'Gestión de caja' })).toBeVisible()
  })

  test('sin scroll horizontal en las pantallas principales a 360px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 })
    await mockSupabase(page, 'admin', FIXTURES)
    for (const ruta of ['/', '/ventas/nueva', '/productos', '/clientes', '/creditos', '/caja']) {
      await ir(page, ruta)
      await page.waitForTimeout(300)
      const desborda = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
      expect(desborda, `scroll horizontal en ${ruta}`).toBe(false)
    }
  })
})
