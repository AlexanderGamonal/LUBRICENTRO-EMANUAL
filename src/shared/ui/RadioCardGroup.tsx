import { useId } from 'react'
import { cn } from '@/shared/utils/cn'

interface Option<T extends string> {
  value: T
  label: string
  description?: string
}

interface RadioCardGroupProps<T extends string> {
  legend: string
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
  required?: boolean
  error?: string
  className?: string
}

/**
 * Selección única con tarjetas. Usa radios nativos (flechas del teclado, lectores de pantalla)
 * dentro de un <fieldset> con <legend>.
 */
export function RadioCardGroup<T extends string>({ legend, options, value, onChange, required, error, className }: RadioCardGroupProps<T>) {
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
      <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:gap-3">
        {options.map((opt) => {
          const checked = opt.value === value
          return (
            <label
              key={opt.value}
              className={cn(
                'relative flex min-h-touch flex-1 cursor-pointer items-center gap-2.5 rounded-lg border-2 px-4 py-2.5 transition-colors md:min-h-0',
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
              <span
                aria-hidden="true"
                className={cn('flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2', checked ? 'border-primary-700' : 'border-fg-subtle')}
              >
                {checked && <span className="h-2 w-2 rounded-full bg-primary-700" />}
              </span>
              <span className="min-w-0">
                <span className="block font-medium">{opt.label}</span>
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
