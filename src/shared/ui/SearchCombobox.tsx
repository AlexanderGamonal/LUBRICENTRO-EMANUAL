import { useEffect, useId, useRef, useState } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/shared/utils/cn'
import { Field } from './Field'

interface SearchComboboxProps<T> {
  label: string
  hideLabel?: boolean
  placeholder?: string
  query: string
  onQueryChange: (query: string) => void
  items: T[]
  getKey: (item: T) => string
  renderItem: (item: T) => ReactNode
  onSelect: (item: T) => void
  loading?: boolean
  /** Mensaje cuando se escribió lo suficiente y no hay resultados. */
  emptyMessage?: ReactNode
  /** Caracteres mínimos para mostrar la lista. */
  minChars?: number
  inputClassName?: string
  inputProps?: Pick<InputHTMLAttributes<HTMLInputElement>, 'maxLength' | 'autoFocus' | 'inputMode' | 'autoCapitalize'>
  inputRef?: React.Ref<HTMLInputElement>
  className?: string
}

/**
 * Buscador con lista de resultados (patrón ARIA combobox + listbox).
 * El padre controla el texto y los resultados; aquí viven el teclado (↑ ↓ Enter Esc),
 * el cierre al hacer clic fuera y la accesibilidad.
 */
export function SearchCombobox<T>({
  label,
  hideLabel,
  placeholder,
  query,
  onQueryChange,
  items,
  getKey,
  renderItem,
  onSelect,
  loading,
  emptyMessage,
  minChars = 1,
  inputClassName,
  inputProps,
  inputRef,
  className,
}: SearchComboboxProps<T>) {
  const listId = useId()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  const enough = query.trim().length >= minChars
  const showList = open && enough && (loading || items.length > 0 || !!emptyMessage)

  useEffect(() => setActive(0), [items])

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  function choose(item: T) {
    onSelect(item)
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) setOpen(true)
      else setActive((i) => (items.length ? (i + 1) % items.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (items.length ? (i - 1 + items.length) % items.length : 0))
    } else if (e.key === 'Enter' && showList && items[active]) {
      e.preventDefault()
      choose(items[active])
    } else if (e.key === 'Escape' && open) {
      e.stopPropagation()
      setOpen(false)
    }
  }

  const activeId = showList && items[active] ? `${listId}-${getKey(items[active])}` : undefined

  return (
    <div ref={wrapperRef} className={cn('relative', className)}>
      <Field label={label} hideLabel={hideLabel}>
        {(p) => (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
            <input
              {...p}
              {...inputProps}
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded={showList}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={activeId}
              autoComplete="off"
              value={query}
              placeholder={placeholder}
              className={cn('input-field pl-9', inputClassName)}
              onFocus={() => setOpen(true)}
              onKeyDown={onKeyDown}
              onChange={(e) => {
                onQueryChange(e.target.value)
                setOpen(true)
              }}
            />
          </div>
        )}
      </Field>

      {showList && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-line bg-card shadow-lg">
          <ul id={listId} role="listbox" aria-label={label} className="scroll-region max-h-64 divide-y divide-line">
            {loading && items.length === 0 && (
              <li role="presentation" className="p-3 text-sm text-fg-muted">
                Buscando…
              </li>
            )}
            {!loading && items.length === 0 && emptyMessage && (
              <li role="presentation" className="p-3 text-sm text-fg-muted">
                {emptyMessage}
              </li>
            )}
            {items.map((item, i) => (
              <li
                key={getKey(item)}
                id={`${listId}-${getKey(item)}`}
                role="option"
                aria-selected={i === active}
                onMouseMove={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(item)}
                className={cn('min-h-[44px] cursor-pointer px-3 py-2.5 md:min-h-0', i === active && 'bg-primary-700/5')}
              >
                {renderItem(item)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
