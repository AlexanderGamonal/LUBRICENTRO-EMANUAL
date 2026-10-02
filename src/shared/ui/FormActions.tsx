import type { ReactNode } from 'react'
import { cn } from '@/shared/utils/cn'

/**
 * Botones de acción de un formulario.
 * En móvil quedan fijos justo encima de la barra inferior (siempre alcanzables aunque el
 * formulario sea largo); desde `md` fluyen al final del formulario.
 */
export function FormActions({ children, className, align = 'start' }: { children: ReactNode; className?: string; align?: 'start' | 'end' }) {
  return (
    <div
      className={cn(
        'sticky bottom-[calc(57px+env(safe-area-inset-bottom))] z-10 -mx-4 mt-6 border-t border-line bg-card/95 px-4 py-2.5 backdrop-blur',
        'sm:-mx-6 sm:px-6',
        'md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none',
        className,
      )}
    >
      <div className={cn('flex flex-row gap-3 [&>*]:flex-1 sm:[&>*]:flex-none', align === 'end' ? 'sm:justify-end' : 'md:justify-start')}>{children}</div>
    </div>
  )
}
