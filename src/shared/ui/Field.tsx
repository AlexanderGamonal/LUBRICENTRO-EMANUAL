import { useId } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/shared/utils/cn'

export interface FieldControlProps {
  id: string
  'aria-describedby'?: string
  'aria-invalid'?: true
  'aria-required'?: true
}

interface FieldProps {
  label: string
  required?: boolean
  /** Texto de ayuda bajo el campo. */
  hint?: string
  /** Mensaje de error (se anuncia a lectores de pantalla y marca el campo como inválido). */
  error?: string
  className?: string
  /** Oculta la etiqueta visualmente (sigue disponible para lectores de pantalla). */
  hideLabel?: boolean
  /** Recibe las props de accesibilidad que hay que esparcir en el control: `<input {...p} />`. */
  children: (control: FieldControlProps) => ReactNode
}

/**
 * Etiqueta + control + ayuda/error correctamente enlazados (htmlFor, aria-describedby, aria-invalid).
 * Tocar la etiqueta enfoca el campo, y los lectores de pantalla leen la etiqueta y el error.
 */
export function Field({ label, required, hint, error, className, hideLabel, children }: FieldProps) {
  const uid = useId()
  const id = `f-${uid}`
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined

  return (
    <div className={className}>
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'label-text'}>
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-red-600">
            *
          </span>
        )}
      </label>
      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        'aria-required': required ? true : undefined,
      })}
      {hint && !error && (
        <p id={hintId} className="mt-1 text-xs text-fg-subtle">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className={cn('error-text')}>
          {error}
        </p>
      )}
    </div>
  )
}
