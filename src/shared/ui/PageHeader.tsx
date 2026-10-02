import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/shared/utils/cn'

interface PageHeaderProps {
  title: string
  description?: string
  /** Muestra "Volver" (historial del navegador). */
  back?: boolean
  /** Acciones a la derecha (botones). */
  actions?: ReactNode
  className?: string
}

/** Cabecera de pantalla: título (h1), descripción, "Volver" y acciones. */
export function PageHeader({ title, description, back, actions, className }: PageHeaderProps) {
  const navigate = useNavigate()
  return (
    <div className={cn('mb-5', className)}>
      {back && (
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="-ml-2 mb-2 inline-flex min-h-touch items-center gap-1 rounded-lg px-2 text-sm font-medium text-fg-muted transition-colors hover:text-primary-700 md:min-h-0 md:py-1"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver
        </button>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-primary-700">{title}</h1>
          {description && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
