import { useCallback, useSyncExternalStore } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'lem-theme'
const listeners = new Set<() => void>()

function readPreference(): ThemePreference {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    /* almacenamiento bloqueado (modo privado): se usa el del sistema */
  }
  return 'system'
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function resolveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref === 'system') return systemPrefersDark() ? 'dark' : 'light'
  return pref
}

/** Aplica la clase `dark` en <html> y el color de la barra del navegador. */
export function applyTheme(pref: ThemePreference): void {
  const resolved = resolveTheme(pref)
  document.documentElement.classList.toggle('dark', resolved === 'dark')
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', resolved === 'dark' ? '#0a0f1c' : '#1F3864')
}

export function setThemePreference(pref: ThemePreference): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, pref)
  } catch {
    /* sin persistencia, el cambio vale solo para esta sesión */
  }
  applyTheme(pref)
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const onSystemChange = () => {
    if (readPreference() === 'system') applyTheme('system')
    cb()
  }
  mq.addEventListener('change', onSystemChange)
  return () => {
    listeners.delete(cb)
    mq.removeEventListener('change', onSystemChange)
  }
}

export function useTheme() {
  const preference = useSyncExternalStore(subscribe, readPreference, () => 'system' as ThemePreference)
  const resolved = useSyncExternalStore(
    subscribe,
    () => resolveTheme(readPreference()),
    () => 'light' as ResolvedTheme,
  )
  const setTheme = useCallback((p: ThemePreference) => setThemePreference(p), [])
  const toggle = useCallback(() => setThemePreference(resolved === 'dark' ? 'light' : 'dark'), [resolved])
  return { preference, resolved, setTheme, toggle }
}
