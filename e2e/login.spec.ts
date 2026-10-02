import { test, expect } from '@playwright/test'

test.describe('Login', () => {
  test('muestra el formulario con campos etiquetados', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('h2', { hasText: 'Iniciar sesión' })).toBeVisible()
    await expect(page.getByLabel('Correo electrónico')).toBeVisible()
    await expect(page.getByLabel('Contraseña', { exact: true })).toBeVisible()
  })

  test('permite mostrar y ocultar la contraseña', async ({ page }) => {
    await page.goto('/login')
    const campo = page.getByLabel('Contraseña', { exact: true })
    await campo.fill('secreto123')
    await expect(campo).toHaveAttribute('type', 'password')
    await page.getByRole('button', { name: 'Mostrar contraseña' }).click()
    await expect(campo).toHaveAttribute('type', 'text')
    await page.getByRole('button', { name: 'Ocultar contraseña' }).click()
    await expect(campo).toHaveAttribute('type', 'password')
  })

  test('valida el correo antes de enviar', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Correo electrónico').fill('no-es-un-correo')
    await page.getByLabel('Contraseña', { exact: true }).fill('secreto123')
    await page.getByRole('button', { name: 'Ingresar' }).click()
    await expect(page.getByRole('alert').or(page.getByText('Ingresa un correo válido'))).toBeVisible()
  })
})
