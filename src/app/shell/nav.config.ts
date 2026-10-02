import {
  Boxes,
  Car,
  ClipboardList,
  HandCoins,
  LayoutDashboard,
  Package,
  Receipt,
  Search,
  ShoppingCart,
  Upload,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { RolUsuario } from '@/shared/types/database'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Coincidencia exacta de ruta (Inicio y listados que comparten prefijo con una pantalla "nueva"). */
  exact?: boolean
  /** Si se define, solo estos roles ven la opción. Debe coincidir con las rutas protegidas en router.tsx. */
  roles?: RolUsuario[]
  /** Palabras extra para el buscador global. */
  keywords?: string[]
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const HOME: NavItem = { to: '/', label: 'Inicio', icon: LayoutDashboard, exact: true, keywords: ['dashboard', 'resumen'] }

/** Acciones de uso constante: se destacan arriba del menú. */
export const PRIMARY_ACTIONS: NavItem[] = [
  { to: '/ventas/nueva', label: 'Nueva venta', icon: ShoppingCart, keywords: ['vender', 'pos', 'cobrar'] },
  { to: '/servicios/nuevo', label: 'Nueva atención', icon: Wrench, keywords: ['servicio', 'cambio de aceite', 'atender'] },
]

const ADMIN_ALMACEN: RolUsuario[] = ['admin', 'superadmin', 'almacen']

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Operación',
    items: [
      { to: '/caja', label: 'Caja', icon: Wallet, keywords: ['apertura', 'cierre', 'turno'] },
      { to: '/creditos', label: 'Créditos', icon: HandCoins, keywords: ['deudas', 'fiado', 'cobranza'] },
    ],
  },
  {
    label: 'Historial',
    items: [
      { to: '/ventas', label: 'Ventas', icon: Receipt, exact: true, keywords: ['historial', 'anular', 'boleta'] },
      { to: '/servicios', label: 'Servicios', icon: ClipboardList, exact: true, keywords: ['historial', 'atenciones'] },
    ],
  },
  {
    label: 'Clientes',
    items: [
      { to: '/clientes', label: 'Clientes', icon: Users },
      { to: '/vehiculos', label: 'Vehículos', icon: Car, keywords: ['placa', 'auto', 'moto'] },
    ],
  },
  {
    label: 'Almacén',
    items: [
      { to: '/productos', label: 'Productos', icon: Package, keywords: ['catálogo', 'precios', 'aceite', 'filtro'] },
      { to: '/inventario', label: 'Inventario', icon: Boxes, keywords: ['stock', 'movimientos', 'existencias'] },
      { to: '/busqueda', label: 'Búsqueda', icon: Search, keywords: ['escanear', 'código', 'qr', 'barras'] },
      { to: '/importacion', label: 'Importar', icon: Upload, roles: ADMIN_ALMACEN, keywords: ['excel', 'masivo', 'cargar'] },
    ],
  },
]

/** Pestañas fijas de la barra inferior en móvil (el resto vive en "Más"). */
export const MOBILE_TABS: NavItem[] = [
  HOME,
  { to: '/ventas/nueva', label: 'Vender', icon: ShoppingCart },
  { to: '/caja', label: 'Caja', icon: Wallet },
  { to: '/servicios/nuevo', label: 'Atender', icon: Wrench },
]

export function canSee(item: NavItem, rol: string | undefined): boolean {
  return !item.roles || (!!rol && (item.roles as string[]).includes(rol))
}

export function visibleGroups(rol: string | undefined): NavGroup[] {
  return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => canSee(i, rol)) })).filter((g) => g.items.length > 0)
}

/** Todos los destinos navegables para el rol (buscador global). */
export function allDestinations(rol: string | undefined): NavItem[] {
  return [HOME, ...PRIMARY_ACTIONS, ...visibleGroups(rol).flatMap((g) => g.items)]
}

/* ── Títulos y migas de pan ─────────────────────────────────── */

export interface Crumb {
  label: string
  to?: string
}

export interface PageMeta {
  title: string
  crumbs: Crumb[]
}

const TITLES: Record<string, string> = {
  '/': 'Inicio',
  '/caja': 'Gestión de caja',
  '/ventas': 'Historial de ventas',
  '/ventas/nueva': 'Nueva venta',
  '/clientes': 'Clientes',
  '/creditos': 'Créditos',
  '/vehiculos': 'Vehículos',
  '/servicios': 'Historial de servicios',
  '/servicios/nuevo': 'Nueva atención',
  '/productos': 'Productos',
  '/inventario': 'Inventario',
  '/busqueda': 'Búsqueda rápida',
  '/importacion': 'Importación',
}

export const APP_NAME = "Lubricentro E' Manuel"

export function getPageMeta(pathname: string): PageMeta {
  const p = pathname.replace(/\/+$/, '') || '/'
  const direct = TITLES[p]
  if (direct) return { title: direct, crumbs: [] }

  const detail = (parent: Crumb, title: string): PageMeta => ({ title, crumbs: [parent, { label: title }] })

  if (p === '/productos/nuevo') return detail({ label: 'Productos', to: '/productos' }, 'Nuevo producto')
  if (/^\/productos\/[^/]+\/editar$/.test(p)) return detail({ label: 'Productos', to: '/productos' }, 'Editar producto')
  if (p.startsWith('/inventario/ajuste/')) return detail({ label: 'Inventario', to: '/inventario' }, 'Ajuste de stock')
  if (p === '/clientes/nuevo') return detail({ label: 'Clientes', to: '/clientes' }, 'Nuevo cliente')
  if (/^\/clientes\/[^/]+\/editar$/.test(p)) return detail({ label: 'Clientes', to: '/clientes' }, 'Editar cliente')
  if (p === '/vehiculos/nuevo') return detail({ label: 'Vehículos', to: '/vehiculos' }, 'Nuevo vehículo')
  if (/^\/vehiculos\/[^/]+\/editar$/.test(p)) return detail({ label: 'Vehículos', to: '/vehiculos' }, 'Editar vehículo')
  if (/^\/vehiculos\/[^/]+$/.test(p)) return detail({ label: 'Vehículos', to: '/vehiculos' }, 'Detalle del vehículo')

  return { title: APP_NAME, crumbs: [] }
}
