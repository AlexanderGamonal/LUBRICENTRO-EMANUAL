import type { Config } from 'tailwindcss'
import plugin from 'tailwindcss/plugin'
import colors from 'tailwindcss/colors'
import forms from '@tailwindcss/forms'

/* ──────────────────────────────────────────────────────────────
 * Tokens semánticos (valores en src/styles/globals.css como "R G B")
 *   bg-canvas  fondo de página      bg-card   superficies
 *   bg-muted   superficie atenuada  border-line  bordes
 *   text-fg / text-fg-muted / text-fg-subtle  jerarquía de texto
 * ────────────────────────────────────────────────────────────── */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`

/* ── Ajuste de contraste (WCAG AA, 4.5:1) ─────────────────────
 * Los tonos por defecto de Tailwind usados como texto sobre blanco o sobre
 * el fondo gris claro no llegan a 4.5:1. Se oscurecen unos pasos; las pantallas
 * existentes lo heredan sin tocar su código.
 */
const contrastFixes = {
  gray: { 400: '#69707e', 500: '#5f6776' },
  slate: { 400: '#5f6f86', 500: '#566680' },
  red: { 500: '#dc2626', 600: '#b91c1c' },
  green: { 500: '#15803d', 600: '#15803d' },
  emerald: { 500: '#047857', 600: '#047857' },
  yellow: { 600: '#a16207', 700: '#854d0e' },
  amber: { 500: '#b45309', 600: '#b45309' },
  orange: { 500: '#c2410c', 600: '#c2410c' },
  sky: { 500: '#0369a1', 600: '#0369a1' },
  blue: { 500: '#2563eb' },
  purple: { 600: '#7e22ce' },
  violet: { 600: '#6d28d9' },
}

/* ── Modo oscuro ──────────────────────────────────────────────
 * `darkMode: 'class'` (clase `dark` en <html>). Además de las variantes `dark:`,
 * se reasignan las utilidades de gris/slate y los colores de estado más usados
 * para que las pantallas ya escritas funcionen en oscuro sin editarlas una a una.
 * Solo se tocan utilidades de fondo claro, texto y borde; los rellenos fuertes
 * (p. ej. bg-red-600 con texto blanco) se dejan como están.
 */
const darkGray = {
  bg: { 50: '15 24 41', 100: '23 34 58', 200: '31 45 73', 300: '44 60 92' },
  text: { 300: '85 101 127', 400: '142 156 180', 500: '160 172 193', 600: '180 191 209', 700: '201 210 225', 800: '224 230 240', 900: '241 245 250' },
  border: { 100: '26 38 64', 200: '36 51 80', 300: '52 69 106', 400: '74 93 133' },
}

const STATUS_HUES = ['red', 'green', 'yellow', 'blue', 'emerald', 'amber', 'orange', 'purple', 'sky', 'violet', 'indigo', 'rose', 'teal'] as const

function hexToRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`
}

function buildDarkRules() {
  const rules: Record<string, Record<string, string>> = {}
  const add = (utility: string, prop: string, value: string) => {
    rules[`.dark .${utility}`] = { [prop]: value }
    // Variante hover: mismo valor, con selector más específico que el de Tailwind.
    rules[`.dark .hover\\:${utility}:hover`] = { [prop]: value }
  }
  const rgb = (v: string) => `rgb(${v})`

  add('bg-white', 'background-color', 'rgb(var(--card))')
  for (const family of ['gray', 'slate']) {
    for (const [shade, v] of Object.entries(darkGray.bg)) add(`bg-${family}-${shade}`, 'background-color', rgb(v))
    for (const [shade, v] of Object.entries(darkGray.text)) add(`text-${family}-${shade}`, 'color', rgb(v))
    for (const [shade, v] of Object.entries(darkGray.border)) {
      add(`border-${family}-${shade}`, 'border-color', rgb(v))
      rules[`.dark .divide-${family}-${shade} > :not([hidden]) ~ :not([hidden])`] = { 'border-color': rgb(v) }
    }
  }
  add('bg-surface-50', 'background-color', 'rgb(var(--muted))')
  add('bg-surface-100', 'background-color', 'rgb(var(--muted))')
  add('placeholder-gray-400', 'color', rgb(darkGray.text[400]))

  for (const hue of STATUS_HUES) {
    const c = colors[hue] as Record<string, string>
    const base = hexToRgb(c[500])
    add(`bg-${hue}-50`, 'background-color', `rgb(${base} / 0.12)`)
    add(`bg-${hue}-100`, 'background-color', `rgb(${base} / 0.2)`)
    add(`bg-${hue}-200`, 'background-color', `rgb(${base} / 0.3)`)
    add(`border-${hue}-100`, 'border-color', `rgb(${base} / 0.3)`)
    add(`border-${hue}-200`, 'border-color', `rgb(${base} / 0.4)`)
    add(`border-${hue}-300`, 'border-color', `rgb(${base} / 0.5)`)
    add(`text-${hue}-500`, 'color', c[400])
    add(`text-${hue}-600`, 'color', c[400])
    add(`text-${hue}-700`, 'color', c[300])
    add(`text-${hue}-800`, 'color', c[200])
  }
  // Marca (azul oscuro #1F3864) y acento
  add('bg-primary-50', 'background-color', 'rgb(61 94 172 / 0.18)')
  add('bg-primary-100', 'background-color', 'rgb(61 94 172 / 0.28)')
  add('text-primary-600', 'color', '#7f9bd6')
  add('text-primary-700', 'color', '#9fb4e0')
  add('text-primary-800', 'color', '#bccaea')
  add('text-primary-900', 'color', '#d5def3')
  add('border-primary-600', 'border-color', '#5a77b8')
  add('border-primary-700', 'border-color', '#5a77b8')
  add('ring-primary-700', '--tw-ring-color', '#5a77b8')
  add('bg-accent-50', 'background-color', 'rgb(14 165 233 / 0.14)')
  add('bg-accent-100', 'background-color', 'rgb(14 165 233 / 0.22)')
  add('text-accent-600', 'color', '#38bdf8')
  add('text-accent-700', 'color', '#7dd3fc')
  return rules
}

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ...Object.fromEntries(
          Object.entries(contrastFixes).map(([name, shades]) => [name, { ...(colors as never as Record<string, object>)[name], ...shades }]),
        ),
        canvas: token('canvas'),
        card: token('card'),
        muted: token('muted'),
        line: token('line'),
        fg: {
          DEFAULT: token('fg'),
          muted: token('fg-muted'),
          subtle: token('fg-subtle'),
        },
        primary: {
          DEFAULT: '#1F3864',
          50: '#e8edf5',
          100: '#c5d0e6',
          200: '#9fb0d5',
          300: '#7890c4',
          400: '#5a77b8',
          500: '#3d5eac',
          600: '#2E4F8A',
          700: '#1F3864',
          800: '#162847',
          900: '#0c192d',
        },
        sidebar: {
          DEFAULT: '#0f172a',
          hover: '#1e293b',
          active: '#1e3a5f',
          border: '#1e293b',
          text: '#a3b1c6',
          textActive: '#f1f5f9',
        },
        accent: {
          DEFAULT: '#0ea5e9',
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
        },
        surface: {
          DEFAULT: '#ffffff',
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
        },
      },
      fontSize: {
        base: ['14px', { lineHeight: '1.5' }],
        lg: ['1.125rem', { lineHeight: '1.75rem', letterSpacing: '-0.01em' }],
        xl: ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '-0.01em' }],
        '2xl': ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.02em' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.02em' }],
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'],
        display: ['"Outfit Variable"', 'Outfit', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.025)',
        'card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.04)',
        sidebar: '4px 0 24px 0 rgba(0,0,0,0.25)',
        stat: '0 8px 24px -4px rgba(14, 165, 233, 0.2)',
        'btn-primary': '0 4px 14px 0 rgba(14, 165, 233, 0.39)',
      },
      spacing: {
        'safe-b': 'env(safe-area-inset-bottom)',
        'safe-t': 'env(safe-area-inset-top)',
      },
      minHeight: { touch: '44px', dvh: '100dvh' },
      minWidth: { touch: '44px' },
      height: { dvh: '100dvh' },
      animation: {
        'fade-in': 'fadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        'slide-in-left': 'slideInLeft 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'sheet-in': 'sheetIn 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
        'overlay-in': 'fadeIn 0.2s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        sheetIn: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [
    forms,
    plugin(({ addBase }) => {
      addBase(buildDarkRules())
    }),
  ],
} satisfies Config
