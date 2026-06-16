import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
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
      },
      fontSize: {
        base: ['14px', { lineHeight: '1.5' }],
      },
      fontFamily: {
        sans: ['Inter', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
} satisfies Config
