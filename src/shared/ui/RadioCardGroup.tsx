import { useId } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/shared/utils/cn'

interface Option<T extends string> {
  value: T
  label: string
  description?: string
  icon?: LucideIcon
}

interface RadioCardGroupProps<T extends string> {
  legend: string
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
  required?: boolean
  error?: string
  className?: string
  /** `grid`: tarjetas verticales en 3 columnas (con ícono); `row`: lista horizontal. */
  layout?: 'row' | 'grid'
}

/**
 * Selección única con tarjetas. Usa radios nativos (flechas del teclado, lectores de pantalla)
 * dentro de un <fieldset> con <legend>.
 */
export function RadioCardGroup<T extends string>({ legend, options, value, onChange, required, error, className, layout = 'row' }: RadioCardGroupProps<T>) {
  const name = useId()
  return (
    <fieldset className={className}>
      <legend className="label-text">
        {legend}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-red-600">
            *
          </span>
        )}
      </legend>
      <div className={cn('mt-1', layout === 'grid' ? 'grid grid-cols-3 gap-2' : 'flex flex-col gap-2 sm:flex-row sm:gap-3')}>
        {options.map((opt) => {
          const checked = opt.value === value
          return (
            <label
              key={opt.value}
              className={cn(
                'relative flex min-h-touch cursor-pointer rounded-lg border-2 transition-colors md:min-h-0',
                layout === 'grid' ? 'flex-col items-center justify-center gap-1 px-2 py-3 text-center' : 'flex-1 items-center gap-2.5 px-4 py-2.5',
                checked ? 'border-primary-700 bg-primary-700/5 text-primary-700' : 'border-line text-fg-muted hover:border-fg-subtle',
                'focus-within:ring-2 focus-within:ring-accent-400 focus-within:ring-offset-2',
              )}
            >
              <input
                type="radio"
                name={name}
                value={opt.value}
                checked={checked}
                onChange={() => onChange(opt.value)}
                className="sr-only"
              />
              {opt.icon ? (
                <opt.icon aria-hidden="true" className="h-5 w-5 flex-shrink-0" />
              ) : (
                <span
                  aria-hidden="true"
                  className={cn('flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2', checked ? 'border-primary-700' : 'border-fg-subtle')}
                >
                  {checked && <span className="h-2 w-2 rounded-full bg-primary-700" />}
                </span>
              )}
              <span className="min-w-0">
                <span className={cn('block font-medium', layout === 'grid' && 'text-xs')}>{opt.label}</span>
                {opt.description && <span className="block text-xs font-normal text-fg-subtle">{opt.description}</span>}
              </span>
            </label>
          )
        })}
      </div>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
    </fieldset>
  )
}
