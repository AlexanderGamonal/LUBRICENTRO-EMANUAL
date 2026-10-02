import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

const STORAGE_KEY = 'lem-sidebar'
const WIDE_QUERY = '(min-width: 1280px)'

type Stored = 'expanded' | 'collapsed'

function readStored(): Stored | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    return v === 'expanded' || v === 'collapsed' ? v : null
  } catch {
    return null
  }
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setMatches(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return matches
}

/**
 * Estado del menú lateral.
 *  - Pantallas anchas (≥1280px): expandido por defecto; la preferencia del usuario se recuerda.
 *  - Tablet / laptop chica (768–1279px): siempre en modo compacto (solo íconos);
 *    al abrirlo se muestra por encima del contenido, sin empujarlo.
 */
export function useSidebar() {
  const isWide = useMediaQuery(WIDE_QUERY)
  const [stored, setStored] = useState<Stored | null>(readStored)
  const [overlayOpen, setOverlayOpen] = useState(false)
  const { pathname } = useLocation()

  // El panel superpuesto se cierra al navegar o al pasar a pantalla ancha.
  useEffect(() => {
    setOverlayOpen(false)
  }, [pathname, isWide])

  useEffect(() => {
    if (!overlayOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOverlayOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [overlayOpen])

  const expanded = isWide ? stored !== 'collapsed' : overlayOpen

  const toggle = useCallback(() => {
    if (isWide) {
      const next: Stored = stored === 'collapsed' ? 'expanded' : 'collapsed'
      setStored(next)
      try {
        window.localStorage.setItem(STORAGE_KEY, next)
      } catch {
        /* sin persistencia */
      }
    } else {
      setOverlayOpen((o) => !o)
    }
  }, [isWide, stored])

  const close = useCallback(() => setOverlayOpen(false), [])

  return { isWide, expanded, toggle, close }
}
