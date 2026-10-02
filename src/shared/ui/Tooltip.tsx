import type { ReactNode } from 'react'
import * as RadixTooltip from '@radix-ui/react-tooltip'
import { cn } from '@/shared/utils/cn'

interface TooltipProps {
  label: string
  children: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  /** Desactiva el tooltip (p. ej. cuando el texto ya está visible). */
  disabled?: boolean
  /** Clases del contenedor (por defecto `inline-flex`). */
  className?: string
}

/**
 * El hijo va dentro de un <span> y NO se usa `asChild` sobre él: Radix fusiona `className`
 * como texto y rompería el `className={({ isActive }) => …}` de NavLink.
 */
export function Tooltip({ label, children, side = 'right', disabled, className }: TooltipProps) {
  const wrapper = cn('inline-flex', className)
  if (disabled) return <span className={wrapper}>{children}</span>
  return (
    <RadixTooltip.Provider delayDuration={150} skipDelayDuration={300}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>
          <span className={wrapper}>{children}</span>
        </RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            side={side}
            sideOffset={8}
            className="z-[60] animate-fade-in rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg dark:bg-slate-100 dark:text-slate-900"
          >
            {label}
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  )
}
