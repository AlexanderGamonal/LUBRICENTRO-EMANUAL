import { useEffect, useState } from 'react'
import { Clock as ClockIcon } from 'lucide-react'

/** Reloj aislado: solo este componente se vuelve a pintar cada 30 s (antes se repintaba todo el layout cada segundo). */
export function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])
  const time = new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' }).format(now)
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-line bg-muted px-3 py-1.5 text-xs font-semibold tabular-nums text-fg-muted">
      <ClockIcon className="h-3.5 w-3.5" aria-hidden="true" />
      <time dateTime={now.toISOString()}>{time}</time>
    </div>
  )
}
