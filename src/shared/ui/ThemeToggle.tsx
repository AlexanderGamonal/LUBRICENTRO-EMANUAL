import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/shared/lib/theme'
import { cn } from '@/shared/utils/cn'

interface ThemeToggleProps {
  className?: string
  /** Muestra el texto junto al ícono (menú móvil, sidebar expandido). */
  showLabel?: boolean
}

export function ThemeToggle({ className, showLabel }: ThemeToggleProps) {
  const { resolved, toggle } = useTheme()
  const isDark = resolved === 'dark'
  const label = isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex min-h-touch items-center justify-center gap-2 rounded-lg px-2.5 text-sm font-medium transition-colors md:min-h-0 md:py-2',
        className,
      )}
    >
      {isDark ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
      {showLabel && <span>{isDark ? 'Modo claro' : 'Modo oscuro'}</span>}
    </button>
  )
}
