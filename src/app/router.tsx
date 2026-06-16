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
          { path: '/productos', element: <ProductosListPage /> },
          {
            path: '/productos/nuevo',
            element: (
              <ProtectedRoute allowedRoles={['admin', 'superadmin', 'almacen']} />
            ),
            children: [{ index: true, element: <ProductoFormPage mode="create" /> }],
          },
          {
            path: '/productos/:id/editar',
            element: (
              <ProtectedRoute allowedRoles={['admin', 'superadmin', 'almacen']} />
            ),
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
