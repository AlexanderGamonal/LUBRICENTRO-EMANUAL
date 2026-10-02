import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/shared/utils/cn'

export type StatTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'

const ICON_TONE: Record<StatTone, string> = {
  neutral: 'icon-circle-primary',
  accent: 'icon-circle-accent',
  success: 'icon-circle-success',
  warning: 'icon-circle-warning',
  danger: 'icon-circle-danger',
}

const VALUE_TONE: Record<StatTone, string> = {
  neutral: 'text-fg',
  accent: 'text-fg',
  success: 'text-emerald-700 dark:text-emerald-300',
  warning: 'text-amber-700 dark:text-amber-300',
  danger: 'text-red-700 dark:text-red-300',
}

interface StatCardProps {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon: LucideIcon
  tone?: StatTone
  /** Muestra un esqueleto en lugar del valor. */
  loading?: boolean
  /** En móvil apila ícono y texto (para grillas de 2 columnas). */
  stackOnMobile?: boolean
  className?: string
}

/** Tarjeta de métrica: ícono con color según significado, etiqueta, valor y nota. */
export function StatCard({ label, value, hint, icon: Icon, tone = 'neutral', loading, stackOnMobile, className }: StatCardProps) {
  return (
    <div className={cn('card flex items-start gap-3 p-4 sm:p-5', stackOnMobile && 'flex-col gap-2 sm:flex-row sm:gap-3', className)}>
      <div className={ICON_TONE[tone]} aria-hidden="true">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{label}</p>
        {loading ? (
          <div aria-hidden="true" className="mt-1.5 h-7 w-24 animate-pulse rounded bg-line/70" />
        ) : (
          <p className={cn('mt-0.5 truncate font-display text-xl font-bold tabular-nums sm:text-2xl', VALUE_TONE[tone])}>{value}</p>
        )}
        {hint && <p className="mt-0.5 text-xs text-fg-subtle">{hint}</p>}
      </div>
    </div>
  )
}
