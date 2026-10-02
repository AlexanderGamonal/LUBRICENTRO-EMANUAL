import { test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { mockSupabase, type MockRol } from './helpers/mockSupabase'

/**
 * Auditoría visual y de accesibilidad (no corre en CI salvo AUDIT=1).
 *   AUDIT=1 AUDIT_LABEL=antes npx playwright test visual-audit
 * Guarda capturas en e2e-shots/<label>/ y un resumen en e2e-shots/<label>/summary.json
 */
const RUN = !!process.env.AUDIT
const LABEL = process.env.AUDIT_LABEL ?? 'actual'
const ROL = (process.env.AUDIT_ROL ?? 'admin') as MockRol

const VIEWPORTS = [
  { name: '360', width: 360, height: 740 },
  { name: '390', width: 390, height: 844 },
  { name: '768', width: 768, height: 1024 },
  { name: '1024', width: 1024, height: 768 },
  { name: '1440', width: 1440, height: 900 },
]

const ROUTES = [
  '/', '/caja', '/ventas/nueva', '/ventas', '/creditos', '/clientes',
  '/servicios/nuevo', '/servicios', '/vehiculos', '/productos', '/inventario', '/busqueda',
]

test.describe('auditoría visual', () => {
  test.skip(!RUN, 'Define AUDIT=1 para ejecutar la auditoría')
  test.setTimeout(10 * 60_000)

  test('capturas + overflow + axe', async ({ browser }) => {
    const dir = `e2e-shots/${LABEL}`
    mkdirSync(dir, { recursive: true })
    const summary: Record<string, unknown>[] = []

    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
      const page = await context.newPage()
      await mockSupabase(page, ROL)

      for (const route of ROUTES) {
        await page.goto(route)
        await page.waitForTimeout(700)
        const overflow = await page.evaluate(() => {
          const el = document.documentElement
          const wide = Array.from(document.querySelectorAll<HTMLElement>('body *'))
            .filter((n) => n.getBoundingClientRect().right > window.innerWidth + 1)
            .slice(0, 3)
            .map((n) => `${n.tagName.toLowerCase()}.${String(n.className).split(' ').slice(0, 3).join('.')}`)
          return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, wide }
        })
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
        const slug = route === '/' ? 'inicio' : route.replace(/\//g, '_').replace(/^_/, '')
        await page.screenshot({ path: `${dir}/${vp.name}-${slug}.png`, fullPage: false })
        summary.push({
          viewport: vp.name,
          route,
          hScroll: overflow.scrollWidth > overflow.clientWidth,
          wideElements: overflow.wide,
          axe: axe.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })),
        })
      }
      await context.close()
    }
    writeFileSync(`${dir}/summary.json`, JSON.stringify(summary, null, 2))
  })
})
