import type { Page } from '@playwright/test'

export type MockRol = 'superadmin' | 'admin' | 'vendedor' | 'almacen'

const PROJECT_REF = 'mock'

function fakeJwt(): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'u-1', role: 'authenticated', exp: 4102444800 })}.sig`
}

export function perfil(rol: MockRol) {
  return {
    id: 'usr-1',
    auth_user_id: 'u-1',
    sucursal_id: 'suc-1',
    nombre: 'Manuel Quispe',
    email: 'manuel@example.com',
    rol,
    activo: true,
  }
}

/**
 * Simula una sesión de Supabase ya iniciada y responde a la API REST con datos
 * mínimos, para poder revisar el layout sin una base de datos real.
 * Solo pensado para pruebas visuales / de navegación; no toca ningún servidor.
 */
export async function mockSupabase(
  page: Page,
  rol: MockRol = 'admin',
  tables: Record<string, unknown[]> = {},
) {
  const session = {
    access_token: fakeJwt(),
    refresh_token: 'mock-refresh',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: 'u-1', aud: 'authenticated', role: 'authenticated', email: 'manuel@example.com' },
  }

  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value)
    },
    [`sb-${PROJECT_REF}-auth-token`, JSON.stringify(session)],
  )

  await page.route(/mock\.supabase\.co\/rest\/v1\//, async (route) => {
    const url = new URL(route.request().url())
    const table = url.pathname.split('/').pop() ?? ''
    const wantsObject = (route.request().headers()['accept'] ?? '').includes('vnd.pgrst.object')
    const rows = table === 'usuarios' ? [perfil(rol)] : (tables[table] ?? [])
    const body = wantsObject ? (rows[0] ?? null) : rows
    const status = wantsObject && rows.length === 0 ? 406 : 200
    await route.fulfill({
      status,
      contentType: 'application/json',
      headers: { 'content-range': `0-${Math.max(rows.length - 1, 0)}/${rows.length}` },
      body: JSON.stringify(body),
    })
  })

  await page.route(/mock\.supabase\.co\/(auth|storage|functions)\/v1\//, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  )
}
