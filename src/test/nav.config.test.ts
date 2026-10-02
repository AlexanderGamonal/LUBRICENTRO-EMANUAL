import { describe, expect, it } from 'vitest'
import { allDestinations, canSee, getPageMeta, visibleGroups, NAV_GROUPS } from '@/app/shell/nav.config'

const labels = (rol: string) => visibleGroups(rol).flatMap((g) => g.items.map((i) => i.label))

describe('menú por rol', () => {
  it('Importar solo lo ven admin, superadmin y almacén (igual que la ruta protegida)', () => {
    expect(labels('vendedor')).not.toContain('Importar')
    expect(labels('almacen')).toContain('Importar')
    expect(labels('admin')).toContain('Importar')
    expect(labels('superadmin')).toContain('Importar')
  })

  it('un rol desconocido o sin sesión no ve opciones restringidas', () => {
    expect(labels('')).not.toContain('Importar')
    expect(canSee({ to: '/x', label: 'x', icon: NAV_GROUPS[0].items[0].icon, roles: ['admin'] }, undefined)).toBe(false)
  })

  it('el buscador global ofrece las mismas pantallas que el menú, sin duplicados', () => {
    const dest = allDestinations('vendedor').map((d) => d.to)
    expect(new Set(dest).size).toBe(dest.length)
    expect(dest).toContain('/ventas/nueva')
    expect(dest).not.toContain('/importacion')
  })

  it('no deja grupos vacíos', () => {
    for (const g of visibleGroups('vendedor')) expect(g.items.length).toBeGreaterThan(0)
  })
})

describe('getPageMeta', () => {
  it('título directo y sin migas en pantallas principales', () => {
    expect(getPageMeta('/caja')).toEqual({ title: 'Gestión de caja', crumbs: [] })
    expect(getPageMeta('/servicios/')).toEqual({ title: 'Historial de servicios', crumbs: [] })
  })

  it('migas de pan en pantallas de detalle y edición', () => {
    expect(getPageMeta('/productos/abc-123/editar')).toEqual({
      title: 'Editar producto',
      crumbs: [{ label: 'Productos', to: '/productos' }, { label: 'Editar producto' }],
    })
    expect(getPageMeta('/vehiculos/9').title).toBe('Detalle del vehículo')
    expect(getPageMeta('/inventario/ajuste/55').crumbs[0]).toEqual({ label: 'Inventario', to: '/inventario' })
  })

  it('ruta desconocida usa el nombre de la app', () => {
    expect(getPageMeta('/no-existe').title).toContain('Manuel')
  })
})
