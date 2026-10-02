import { test, expect } from '@playwright/test'
import { mockSupabase } from './helpers/mockSupabase'
import { FIXTURES } from './fixtures'

test.describe('Caja', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('abre el turno con el monto de apertura', async ({ page }) => {
    const { rpcCalls } = await mockSupabase(page, 'admin', { ...FIXTURES, cajas: [] }, { abrir_caja: { id: 'caja-9' } })
    await page.goto('/caja')
    await expect(page.getByRole('heading', { name: 'No hay caja abierta' })).toBeVisible()

    await page.getByLabel('Monto de apertura (S/)').fill('50')
    await page.getByRole('button', { name: 'Abrir caja' }).click()

    await expect.poll(() => rpcCalls.find((c) => c.name === 'abrir_caja')?.body).toMatchObject({ p_monto_apertura: 50 })
  })

  test('cierra el turno desde un diálogo y muestra si falta o sobra', async ({ page }) => {
    const { rpcCalls } = await mockSupabase(page, 'admin', FIXTURES, { cerrar_caja: { caja_id: 'caja-1' } })
    await page.goto('/caja')
    await expect(page.getByText('CAJA ABIERTA')).toBeVisible()

    await page.getByRole('button', { name: 'Cerrar caja' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Confirmar cierre de caja' })
    await expect(dialogo).toBeVisible()
    await expect(dialogo.getByLabel(/efectivo contado/)).toBeFocused()

    await dialogo.getByLabel(/efectivo contado/).fill('0')
    await expect(dialogo.getByRole('status')).toContainText('Falta')

    await dialogo.getByLabel(/efectivo contado/).fill('99999')
    await expect(dialogo.getByRole('status')).toContainText('Sobra')

    await dialogo.getByLabel('Observaciones (opcional)').fill('Todo conforme')
    await dialogo.getByRole('button', { name: 'Confirmar cierre' }).click()

    await expect
      .poll(() => rpcCalls.find((c) => c.name === 'cerrar_caja')?.body)
      .toMatchObject({ p_caja_id: 'caja-1', p_monto_real: 99999, p_observaciones: 'Todo conforme' })
  })

  test('Escape cierra el diálogo sin cerrar la caja', async ({ page }) => {
    const { rpcCalls } = await mockSupabase(page, 'admin', FIXTURES)
    await page.goto('/caja')
    await page.getByRole('button', { name: 'Cerrar caja' }).click()
    await expect(page.getByRole('dialog', { name: 'Confirmar cierre de caja' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()
    expect(rpcCalls.filter((c) => c.name === 'cerrar_caja')).toHaveLength(0)
  })
})
