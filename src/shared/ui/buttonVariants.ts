import { cva } from 'class-variance-authority'

/** Reutiliza las clases de componente de globals.css para que botón y `<button class="btn-*">` se vean igual. */
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 select-none whitespace-nowrap',
  {
    variants: {
      variant: {
        primary: 'btn-primary',
        secondary: 'btn-secondary',
        danger: 'btn-danger',
        accent: 'btn-accent',
        ghost:
          'rounded-lg font-medium text-fg-muted hover:bg-muted hover:text-fg transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:ring-2 focus-visible:ring-accent-400',
      },
      size: {
        sm: '!px-3 !py-1.5 text-xs',
        md: 'text-sm',
        lg: '!px-5 !py-3 text-base',
        icon: '!p-2 aspect-square',
      },
      block: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'primary', size: 'md', block: false },
  },
)
