import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster } from 'sonner'
import { queryClient } from '@/shared/lib/queryClient'
import { AuthProvider } from '@/features/auth/AuthProvider'

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: { fontSize: '14px' },
          }}
        />
      </AuthProvider>
      {/* Solo existe en desarrollo; en móvil no se monta para no tapar la barra inferior */}
      {window.matchMedia('(min-width: 768px)').matches && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  )
}
