import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from './layout'
import { LoginPage } from '@/features/auth/LoginPage'
import { ProtectedRoute } from '@/features/auth/ProtectedRoute'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { ProductosListPage } from '@/features/productos/ProductosListPage'
import { ProductoFormPage } from '@/features/productos/ProductoFormPage'
import { InventarioPage } from '@/features/inventario/InventarioPage'
import { AjusteStockPage } from '@/features/inventario/AjusteStockPage'
import { BusquedaRapidaPage } from '@/features/busqueda/BusquedaRapidaPage'
import { ImportacionPage } from '@/features/importacion/ImportacionPage'
import CajaPage from '@/features/caja/CajaPage'
import ClientesPage from '@/features/clientes/ClientesPage'
import ClienteFormPage from '@/features/clientes/ClienteFormPage'
import CreditosPage from '@/features/creditos/CreditosPage'
import VentasPage from '@/features/ventas/VentasPage'
import NuevaVentaPage from '@/features/ventas/NuevaVentaPage'
import VehiculosPage from '@/features/vehiculos/VehiculosPage'
import VehiculoFormPage from '@/features/vehiculos/VehiculoFormPage'
// VehiculoDetallePage, ServiciosPage, NuevoServicioPage — WIP (completando)

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <DashboardPage /> },

          // Ventas
          { path: '/caja', element: <CajaPage /> },
          { path: '/ventas/nueva', element: <NuevaVentaPage /> },
          { path: '/ventas', element: <VentasPage /> },
          { path: '/creditos', element: <CreditosPage /> },

          // Clientes
          { path: '/clientes', element: <ClientesPage /> },
          {
            path: '/clientes/nuevo',
            element: <ProtectedRoute allowedRoles={['admin', 'superadmin', 'vendedor']} />,
            children: [{ index: true, element: <ClienteFormPage /> }],
          },
          {
            path: '/clientes/:id/editar',
            element: <ProtectedRoute allowedRoles={['admin', 'superadmin', 'vendedor']} />,
            children: [{ index: true, element: <ClienteFormPage /> }],
          },

          // Vehículos
          { path: '/vehiculos', element: <VehiculosPage /> },
          { path: '/vehiculos/nuevo', element: <VehiculoFormPage /> },
          { path: '/vehiculos/:id/editar', element: <VehiculoFormPage /> },
          // /vehiculos/:id y /servicios/* — WIP (completando)

          // Inventario
          { path: '/productos', element: <ProductosListPage /> },
          {
            path: '/productos/nuevo',
            element: <ProtectedRoute allowedRoles={['admin', 'superadmin', 'almacen']} />,
            children: [{ index: true, element: <ProductoFormPage mode="create" /> }],
          },
          {
            path: '/productos/:id/editar',
            element: <ProtectedRoute allowedRoles={['admin', 'superadmin', 'almacen']} />,
            children: [{ index: true, element: <ProductoFormPage mode="edit" /> }],
          },
          { path: '/inventario', element: <InventarioPage /> },
          { path: '/inventario/ajuste/:productoId', element: <AjusteStockPage /> },
          { path: '/busqueda', element: <BusquedaRapidaPage /> },
          { path: '/importacion', element: <ImportacionPage /> },

          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
])
