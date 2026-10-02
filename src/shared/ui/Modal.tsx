import type { ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/shared/utils/cn'

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl'

const SIZE: Record<ModalSize, string> = {
  sm: 'md:max-w-sm',
  md: 'md:max-w-md',
  lg: 'md:max-w-2xl',
  xl: 'md:max-w-4xl',
}

interface ModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  /** Oculta el título visualmente (sigue disponible para lectores de pantalla). */
  hideTitle?: boolean
  size?: ModalSize
  children: ReactNode
  footer?: ReactNode
  /** Clases extra para el panel (p. ej. bg oscuro del menú móvil). */
  className?: string
  /** Evita cerrar al hacer clic fuera o con Escape (formularios con datos sin guardar). */
  persistent?: boolean
  /** Permite elegir qué elemento recibe el foco al abrir (por defecto, el primero enfocable). */
  onOpenAutoFocus?: (event: Event) => void
}

/**
 * Diálogo accesible (Radix): foco atrapado, Escape, `role="dialog"`, `aria-modal`.
 * En móvil se muestra como hoja inferior; desde `md` como ventana centrada.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  hideTitle,
  size = 'md',
  children,
  footer,
  className,
  persistent,
  onOpenAutoFocus,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay data-print="hide" className="fixed inset-0 z-50 animate-overlay-in bg-black/50 backdrop-blur-[2px]" />
        <Dialog.Content
          onOpenAutoFocus={onOpenAutoFocus}
          onInteractOutside={persistent ? (e) => e.preventDefault() : undefined}
          onEscapeKeyDown={persistent ? (e) => e.preventDefault() : undefined}
          className={cn(
            'fixed z-50 flex flex-col bg-card text-fg shadow-2xl outline-none animate-sheet-in',
            'inset-x-0 bottom-0 max-h-[88dvh] rounded-t-2xl pb-safe-b',
            'md:inset-auto md:left-1/2 md:top-1/2 md:w-[calc(100%-2rem)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:pb-0 md:max-h-[85dvh]',
            SIZE[size],
            className,
          )}
        >
          {/* Asa visual de la hoja (solo móvil) */}
          <div className="flex justify-center pt-2.5 md:hidden" aria-hidden="true">
            <div className="h-1 w-10 rounded-full bg-line" />
          </div>

          <div className={cn('flex items-start justify-between gap-3 px-5 pt-3 md:pt-5', hideTitle && 'sr-only')}>
            <div className="min-w-0">
              <Dialog.Title className="text-base font-bold text-fg">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-0.5 text-sm text-fg-muted">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
          </div>

          {!persistent && (
            <Dialog.Close
              aria-label="Cerrar"
              className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-lg text-fg-subtle transition-colors hover:bg-muted hover:text-fg md:right-4 md:top-4"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </Dialog.Close>
          )}

          <div className="scroll-region min-h-0 flex-1 px-5 py-4">
            {children}
          </div>

          {footer && (
            <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-3 sm:flex-row sm:justify-end">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
