import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/shared/ui'
import { cn } from '@/shared/utils/cn'
import { formatCurrency } from '@/shared/utils/formatters'
import { MEDIOS_MIXTO, errorPagoMixto, nuevaKey, redondear, sumaPagos } from './pagoMixto'
import type { MedioMixto, PagoLinea } from './pagoMixto'

interface PagoMixtoEditorProps {
  total: number
  lineas: PagoLinea[]
  onChange: (lineas: PagoLinea[]) => void
}

/** Reparte un total entre varios medios de pago (p. ej. S/ 50 en efectivo + S/ 30 en Yape). */
export function PagoMixtoEditor({ total, lineas, onChange }: PagoMixtoEditorProps) {
  const error = errorPagoMixto(lineas, total)
  const resto = redondear(total - sumaPagos(lineas))
  const usados = new Set(lineas.map((l) => l.medio))
  const disponible = MEDIOS_MIXTO.find((m) => !usados.has(m.value))

  function actualizar(key: string, cambio: Partial<PagoLinea>) {
    onChange(lineas.map((l) => (l.key === key ? { ...l, ...cambio } : l)))
  }

  return (
    <fieldset className="space-y-3 rounded-xl bg-muted p-4">
      <legend className="sr-only">Reparto del pago entre medios</legend>

      <ul className="space-y-2">
        {lineas.map((l, i) => (
          <li key={l.key} className="flex items-center gap-2">
            <select
              aria-label={`Medio de pago ${i + 1}`}
              value={l.medio}
              onChange={(e) => actualizar(l.key, { medio: e.target.value as MedioMixto })}
              className="input-field min-w-0 flex-1"
            >
              {MEDIOS_MIXTO.map((m) => (
                <option key={m.value} value={m.value} disabled={usados.has(m.value) && m.value !== l.medio}>
                  {m.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={0.1}
              aria-label={`Monto en ${MEDIOS_MIXTO.find((m) => m.value === l.medio)?.label ?? 'medio'} (S/)`}
              value={l.monto || ''}
              placeholder="0.00"
              onChange={(e) => actualizar(l.key, { monto: parseFloat(e.target.value) || 0 })}
              className="input-field w-28 text-right font-semibold"
            />
            <button
              type="button"
              onClick={() => onChange(lineas.filter((x) => x.key !== l.key))}
              disabled={lineas.length === 1}
              aria-label={`Quitar medio de pago ${i + 1}`}
              className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-lg text-fg-subtle transition-colors hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={!disponible}
          onClick={() => disponible && onChange([...lineas, { key: nuevaKey(), medio: disponible.value, monto: Math.max(0, resto) }])}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Agregar medio
        </Button>
        {Math.abs(resto) > 0.01 && lineas.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              const ultima = lineas[lineas.length - 1]
              actualizar(ultima.key, { monto: Math.max(0, redondear(ultima.monto + resto)) })
            }}
          >
            Ajustar el último
          </Button>
        )}
      </div>

      <p
        role="status"
        aria-live="polite"
        className={cn('flex justify-between text-sm font-medium', error ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300')}
      >
        <span>{error ?? 'El reparto cubre el total'}</span>
        <span className="tabular-nums">
          {formatCurrency(sumaPagos(lineas))} / {formatCurrency(total)}
        </span>
      </p>
    </fieldset>
  )
}
