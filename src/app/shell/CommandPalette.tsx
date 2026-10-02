import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CornerDownLeft, Package, Search } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Modal } from '@/shared/ui'
import { cn } from '@/shared/utils/cn'
import { supabase } from '@/shared/lib/supabase'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { useAuth } from '@/features/auth/AuthProvider'
import { formatCurrency } from '@/shared/utils/formatters'
import { allDestinations } from './nav.config'

interface PaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface Option {
  id: string
  group: 'Ir a' | 'Productos'
  label: string
  hint?: string
  icon: LucideIcon
  to: string
}

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

interface ProductoHit {
  id: string
  codigo_interno: string
  nombre: string
  marca: string | null
  stock_actual: number
  precio_venta: number
}

/** Buscador global: ir a cualquier pantalla (según el rol) o buscar un producto. Atajo: Ctrl/⌘ + K. */
export function CommandPalette({ open, onOpenChange }: PaletteProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const listId = useId()
  const listRef = useRef<HTMLUListElement>(null)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const debounced = useDebounce(query, 250)

  useEffect(() => {
    if (!open) {
      setQuery('')
      setActive(0)
    }
  }, [open])

  const destinations = useMemo(() => {
    const q = normalize(query)
    const all = allDestinations(user?.rol)
    const list = q
      ? all.filter((d) => normalize([d.label, ...(d.keywords ?? [])].join(' ')).includes(q))
      : all
    return list.map<Option>((d) => ({ id: `nav-${d.to}`, group: 'Ir a', label: d.label, icon: d.icon, to: d.to }))
  }, [query, user?.rol])

  const { data: productos = [], isFetching } = useQuery({
    queryKey: ['palette-productos', user?.sucursal_id, debounced],
    enabled: open && !!user && debounced.trim().length >= 2,
    staleTime: 30_000,
    queryFn: async () => {
      if (!user) return []
      const term = debounced.trim().replace(/[%,()]/g, ' ')
      const { data, error } = await supabase
        .from('vw_productos_detalle')
        .select('id, codigo_interno, nombre, marca, stock_actual, precio_venta')
        .eq('sucursal_id', user.sucursal_id)
        .eq('activo', true)
        .or(`nombre.ilike.%${term}%,codigo_interno.ilike.%${term}%,marca.ilike.%${term}%`)
        .order('nombre')
        .limit(6)
      if (error) throw error
      return (data ?? []) as ProductoHit[]
    },
  })

  const options: Option[] = useMemo(
    () => [
      ...destinations,
      ...productos.map<Option>((p) => ({
        id: `prod-${p.id}`,
        group: 'Productos',
        label: p.nombre,
        hint: `${p.codigo_interno} · Stock ${p.stock_actual} · ${formatCurrency(p.precio_venta)}`,
        icon: Package,
        to: `/productos?q=${encodeURIComponent(p.codigo_interno)}`,
      })),
    ],
    [destinations, productos],
  )

  useEffect(() => setActive(0), [query, productos.length])

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  function choose(opt: Option | undefined) {
    if (!opt) return
    onOpenChange(false)
    navigate(opt.to)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (options.length ? (i + 1) % options.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (options.length ? (i - 1 + options.length) % options.length : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(options[active])
    }
  }

  const activeId = options[active] ? `${listId}-${options[active].id}` : undefined
  let lastGroup = ''

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Buscador global" description="Busca una pantalla o un producto" hideTitle size="lg" className="md:top-[20%] md:-translate-y-0">
      <div className="-mx-5 -my-4">
        <div className="flex items-center gap-3 border-b border-line px-5 py-3">
          <Search className="h-5 w-5 flex-shrink-0 text-fg-subtle" aria-hidden="true" />
          <input
            autoFocus
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={activeId}
            aria-label="Buscar pantalla o producto"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Buscar pantalla o producto (nombre, código, marca)…"
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-base text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-0"
          />
          {isFetching && <span className="text-xs text-fg-subtle">Buscando…</span>}
        </div>

        <ul id={listId} ref={listRef} role="listbox" aria-label="Resultados" className="scroll-region max-h-[50dvh] p-2">
          {options.length === 0 && (
            <li className="px-3 py-8 text-center text-sm text-fg-muted" role="presentation">
              Sin resultados para «{query}».
            </li>
          )}
          {options.map((opt, i) => {
            const header = opt.group !== lastGroup
            lastGroup = opt.group
            const Icon = opt.icon
            return (
              <li key={opt.id} role="presentation">
                {header && (
                  <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-fg-subtle" role="presentation">
                    {opt.group}
                  </p>
                )}
                <div
                  id={`${listId}-${opt.id}`}
                  role="option"
                  aria-selected={i === active}
                  data-index={i}
                  onMouseMove={() => setActive(i)}
                  onClick={() => choose(opt)}
                  className={cn(
                    'flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm',
                    i === active ? 'bg-primary-700/10 text-fg dark:bg-accent-400/15' : 'text-fg-muted',
                  )}
                >
                  <Icon className="h-[18px] w-[18px] flex-shrink-0 text-fg-subtle" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-fg">{opt.label}</span>
                    {opt.hint && <span className="block truncate text-xs text-fg-subtle">{opt.hint}</span>}
                  </span>
                  {i === active && <CornerDownLeft className="hidden h-4 w-4 flex-shrink-0 text-fg-subtle md:block" aria-hidden="true" />}
                </div>
              </li>
            )
          })}
        </ul>

        <p className="hidden border-t border-line px-5 py-2 text-xs text-fg-subtle md:block">
          ↑ ↓ para moverte · Enter para abrir · Esc para cerrar
        </p>
      </div>
    </Modal>
  )
}
