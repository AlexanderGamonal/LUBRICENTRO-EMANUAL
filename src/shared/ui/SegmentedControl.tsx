import { cn } from '@/shared/utils/cn'

interface Option<T extends string> {
  value: T
  label: string
  /** Contador opcional (se muestra como insignia si es mayor que 0). */
  count?: number
}

interface SegmentedControlProps<T extends string> {
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
  /** Nombre accesible del grupo, p. ej. "Filtrar por estado". */
  label: string
  className?: string
}

/** Filtro tipo pestañas (un solo valor activo). Botones con `aria-pressed`, accesible con teclado. */
export function SegmentedControl<T extends string>({ options, value, onChange, label, className }: SegmentedControlProps<T>) {
  return (
    <div role="group" aria-label={label} className={cn('flex w-full max-w-full gap-1 overflow-x-auto rounded-xl border border-line bg-muted p-1 sm:inline-flex sm:w-auto', className)}>
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex min-h-touch flex-1 flex-shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-semibold transition-colors sm:flex-initial sm:px-3.5 md:min-h-0',
              active ? 'bg-card text-primary-700 shadow-sm' : 'text-fg-muted hover:text-fg',
            )}
          >
            {opt.label}
            {opt.count != null && opt.count > 0 && (
              <span className={cn('rounded-full px-1.5 py-0.5 text-xs font-semibold', active ? 'bg-primary-700/10 text-primary-700' : 'bg-line text-fg-muted')}>
                {opt.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
