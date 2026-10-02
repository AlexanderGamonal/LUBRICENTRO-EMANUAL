import { useEffect, useId, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, X } from 'lucide-react'
import { supabase } from '@/shared/lib/supabase'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { Field } from '@/shared/ui'
import { cn } from '@/shared/utils/cn'

export interface ClienteOption {
  id: string
  nombre: string
  telefono: string | null
}

interface ClienteComboboxProps {
  sucursalId: string
  /** id del cliente seleccionado ('' si ninguno). */
  value: string
  selectedNombre: string
  onChange: (id: string, nombre: string) => void
  label?: string
  error?: string
}

/**
 * Selector de cliente con búsqueda. Patrón ARIA "combobox + listbox":
 * flechas ↑↓ para moverse, Enter para elegir, Esc para cerrar.
 */
export function ClienteCombobox({ sucursalId, value, selectedNombre, onChange, label = 'Cliente asociado', error }: ClienteComboboxProps) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [active, setActive] = useState(0)
  const debouncedSearch = useDebounce(searchInput, 250)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const selected = !!value

  // Cierra al hacer clic fuera
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const { data: clientes = [], isLoading } = useQuery<ClienteOption[]>({
    queryKey: ['clientes-combobox', sucursalId, debouncedSearch],
    queryFn: async () => {
      let q = supabase.from('clientes').select('id, nombre, telefono').eq('sucursal_id', sucursalId).eq('activo', true)
      if (debouncedSearch.trim()) q = q.ilike('nombre', `%${debouncedSearch.trim()}%`)
      const { data, error: err } = await q.order('nombre').limit(20)
      if (err) throw err
      return data ?? []
    },
    enabled: open && !selected && !!sucursalId,
  })

  useEffect(() => setActive(0), [debouncedSearch, clientes.length])

  function choose(c: ClienteOption) {
    onChange(c.id, c.nombre)
    setOpen(false)
    setSearchInput('')
  }

  function clear() {
    onChange('', '')
    setSearchInput('')
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (selected) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) setOpen(true)
      else setActive((i) => (clientes.length ? (i + 1) % clientes.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (clientes.length ? (i - 1 + clientes.length) % clientes.length : 0))
    } else if (e.key === 'Enter' && open && clientes[active]) {
      e.preventDefault()
      choose(clientes[active])
    } else if (e.key === 'Escape' && open) {
      e.stopPropagation()
      setOpen(false)
    }
  }

  const showList = open && !selected
  const activeId = showList && clientes[active] ? `${listId}-${clientes[active].id}` : undefined

  return (
    <div ref={wrapperRef} className="relative">
      <Field label={label} error={error}>
        {(p) => (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
            <input
              {...p}
              type="text"
              role="combobox"
              aria-expanded={showList}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={activeId}
              autoComplete="off"
              readOnly={selected}
              value={selected ? selectedNombre : searchInput}
              placeholder="Buscar cliente por nombre..."
              className={cn('input-field pl-9', selected && 'pr-11 font-medium')}
              onFocus={() => !selected && setOpen(true)}
              onKeyDown={onKeyDown}
              onChange={(e) => {
                setSearchInput(e.target.value)
                setOpen(true)
              }}
            />
            {selected && (
              <button
                type="button"
                onClick={clear}
                aria-label="Quitar cliente"
                className="absolute right-1 top-1/2 flex h-[40px] w-[40px] -translate-y-1/2 items-center justify-center rounded-lg text-fg-subtle transition-colors hover:text-red-600"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </Field>

      {showList && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-line bg-card shadow-lg">
          <ul id={listId} role="listbox" aria-label="Clientes" className="scroll-region max-h-56 divide-y divide-line">
            {isLoading && (
              <li role="presentation" className="p-4 text-sm text-fg-muted">
                Buscando…
              </li>
            )}
            {!isLoading && clientes.length === 0 && (
              <li role="presentation" className="p-4 text-center text-sm text-fg-muted">
                {debouncedSearch ? `No se encontraron clientes con «${debouncedSearch}»` : 'No hay clientes disponibles'}
              </li>
            )}
            {clientes.map((c, i) => (
              <li
                key={c.id}
                id={`${listId}-${c.id}`}
                role="option"
                aria-selected={i === active}
                onMouseMove={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(c)}
                className={cn('min-h-[44px] cursor-pointer px-4 py-2.5 md:min-h-0', i === active && 'bg-primary-700/5')}
              >
                <div className="text-sm font-medium text-fg">{c.nombre}</div>
                {c.telefono && <div className="mt-0.5 text-xs text-fg-subtle">{c.telefono}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
