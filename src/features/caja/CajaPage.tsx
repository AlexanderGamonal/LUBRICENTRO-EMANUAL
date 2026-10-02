import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import { formatCurrency, formatDate, formatDateTime, formatMedioPago, hoyLima } from '@/shared/utils/formatters'
import { AlertTriangle, ClipboardList, Lock, Wallet } from 'lucide-react'
import { Button, DataTable, EmptyState, Field, Modal, PageHeader, SegmentedControl, Skeleton } from '@/shared/ui'
import type { Column } from '@/shared/ui'
import { cn } from '@/shared/utils/cn'
import type { Database } from '@/shared/types/database'

type CajaRow = Database['public']['Tables']['cajas']['Row']

interface MedioResumen {
  medio: string
  ingresos: number
  egresos: number
  neto: number
}

interface ResumenCaja {
  monto_apertura: number
  medios: MedioResumen[]
  credito_por_cobrar: number
}

/** Una sola fuente de verdad: la base de datos calcula lo mismo que usa al cerrar la caja. */
function resumirMedios(medios: MedioResumen[]) {
  const efectivo = medios.find((m) => m.medio === 'efectivo')?.neto ?? 0
  const digital = medios.filter((m) => m.medio !== 'efectivo').reduce((s, m) => s + m.neto, 0)
  const ingresos = medios.reduce((s, m) => s + m.ingresos, 0)
  const egresos = medios.reduce((s, m) => s + m.egresos, 0)
  return { efectivo, digital, ingresos, egresos, total: efectivo + digital }
}

function duracion(opened: string, closed: string | null): string {
  if (!closed) return '—'
  const ms = new Date(closed).getTime() - new Date(opened).getTime()
  if (isNaN(ms) || ms < 0) return '—'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return `${h}h ${m}m`
}

export default function CajaPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<'turno' | 'historial'>('turno')

  const [montoApertura, setMontoApertura] = useState<number>(0)
  const [abriendo, setAbriendo] = useState(false)

  const [showCerrarForm, setShowCerrarForm] = useState(false)
  const [montoReal, setMontoReal] = useState<number>(0)
  const [observaciones, setObservaciones] = useState('')
  const [cerrando, setCerrando] = useState(false)

  /* ── Caja activa ─────────────────────────────────────────── */
  const { data: caja, isLoading: loadingCaja } = useQuery<CajaRow | null>({
    queryKey: ['caja-activa', user?.sucursal_id],
    queryFn: async () => {
      if (!user?.sucursal_id) return null
      const { data, error } = await supabase
        .from('cajas')
        .select('*')
        .eq('sucursal_id', user.sucursal_id)
        .eq('estado', 'abierta')
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!user?.sucursal_id,
    retry: 1,
    staleTime: 0,          // siempre refetch al montar — evita datos de caché incompletos
    refetchOnMount: true,
  })

  // Si la caja cargó pero le faltan campos clave (fecha undefined),
  // auto-invalida para refetcher con datos completos
  const prevCajaIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (caja && !caja.fecha && caja.id !== prevCajaIdRef.current) {
      prevCajaIdRef.current = caja.id
      queryClient.invalidateQueries({ queryKey: ['caja-activa', user?.sucursal_id] })
    }
  }, [caja, user?.sucursal_id, queryClient])

  /* ── Resumen del turno por medio de pago ─────────────────── */
  const {
    data: resumen,
    isLoading: resumenLoading,
    isError: resumenError,
    refetch: refetchResumen,
  } = useQuery<ResumenCaja>({
    queryKey: ['resumen-caja', caja?.id],
    queryFn: async () => {
      if (!caja?.id) return { monto_apertura: 0, medios: [], credito_por_cobrar: 0 }
      const { data, error } = await supabase.rpc('resumen_caja', { p_caja_id: caja.id })
      if (error) throw error
      return data as unknown as ResumenCaja
    },
    enabled: !!caja?.id,
    retry: 1,
    staleTime: 0,
    refetchOnMount: true,
  })

  /* ── Historial de cajas cerradas ─────────────────────────── */
  const { data: historial = [], isLoading: loadingHistorial } = useQuery<CajaRow[]>({
    queryKey: ['cajas-historial', user?.sucursal_id],
    queryFn: async () => {
      if (!user?.sucursal_id) return []
      const { data, error } = await supabase
        .from('cajas')
        .select('*')
        .eq('sucursal_id', user.sucursal_id)
        .eq('estado', 'cerrada')
        .order('fecha', { ascending: false })
        .limit(60)
      if (error) throw error
      return data ?? []
    },
    enabled: !!user?.sucursal_id,
    retry: 1,
    staleTime: 60_000,
  })

  /* ── Acciones ─────────────────────────────────────────────── */
  async function handleAbrirCaja() {
    if (!user) return
    setAbriendo(true)
    try {
      const { error } = await supabase.rpc('abrir_caja', {
        p_monto_apertura: montoApertura,
      })
      if (error) throw error
      await queryClient.invalidateQueries({ queryKey: ['caja-activa'] })
      await queryClient.invalidateQueries({ queryKey: ['cajas-historial'] })
      toast.success('Caja abierta exitosamente')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al abrir la caja'
      toast.error(msg)
    } finally {
      setAbriendo(false)
    }
  }

  async function handleCerrarCaja() {
    if (!caja) return
    setCerrando(true)
    try {
      const { error } = await supabase.rpc('cerrar_caja', {
        p_caja_id: caja.id,
        p_monto_real: montoReal,
        p_observaciones: observaciones || null,
      })
      if (error) throw error
      await queryClient.invalidateQueries({ queryKey: ['caja-activa'] })
      await queryClient.invalidateQueries({ queryKey: ['resumen-caja'] })
      await queryClient.invalidateQueries({ queryKey: ['cajas-historial'] })
      toast.success('Caja cerrada correctamente')
      setShowCerrarForm(false)
      setMontoReal(0)
      setObservaciones('')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cerrar la caja'
      toast.error(msg)
    } finally {
      setCerrando(false)
    }
  }

  const today = hoyLima()
  const medios = resumen?.medios ?? []
  const totales = resumirMedios(medios)
  const esperado = caja ? Number(caja.monto_apertura) + totales.efectivo : 0
  const diferencia = montoReal - esperado

  function cerrarModalCierre() {
    if (cerrando) return
    setShowCerrarForm(false)
    setMontoReal(0)
    setObservaciones('')
  }

  const columnasHistorial: Column<CajaRow>[] = [
    {
      key: 'fecha',
      header: 'Fecha',
      mobile: 'title',
      cell: (c) => (
        <div>
          <p className="font-bold text-primary-700">{formatDate(c.fecha)}</p>
          <p className="text-xs font-normal text-fg-subtle">
            {formatDateTime(c.opened_at)} → {c.closed_at ? formatDateTime(c.closed_at) : '—'} ({duracion(c.opened_at, c.closed_at)})
          </p>
        </div>
      ),
    },
    { key: 'apertura', header: 'Apertura', align: 'right', cell: (c) => formatCurrency(c.monto_apertura) },
    {
      key: 'esperado',
      header: 'Efectivo esperado',
      align: 'right',
      cell: (c) => <span className="font-medium text-sky-700">{c.monto_cierre_esperado != null ? formatCurrency(c.monto_cierre_esperado) : '—'}</span>,
    },
    {
      key: 'real',
      header: 'Real contado',
      align: 'right',
      cell: (c) => <span className="font-medium text-fg">{c.monto_cierre_real != null ? formatCurrency(c.monto_cierre_real) : '—'}</span>,
    },
    {
      key: 'dif',
      header: 'Diferencia',
      align: 'right',
      cell: (c) => {
        const dif = Number(c.diferencia ?? 0)
        return (
          <span
            className={cn(
              'inline-block rounded-full px-3 py-1 text-sm font-bold',
              dif > 0 ? 'bg-green-100 text-green-700' : dif < 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700',
            )}
          >
            {dif > 0 ? '+' : ''}
            {formatCurrency(dif)}
          </span>
        )
      },
    },
    {
      key: 'obs',
      header: 'Observaciones',
      hideBelowLg: true,
      className: 'max-w-[220px] truncate text-xs italic',
      cell: (c) => c.observaciones ?? '—',
    },
  ]

  /* ── Loading inicial ──────────────────────────────────────── */
  if (loadingCaja) {
    return (
      <div className="mx-auto max-w-3xl animate-fade-in p-4 sm:p-6" aria-busy="true">
        <Skeleton className="mb-2 h-8 w-56" />
        <Skeleton className="mb-6 h-4 w-32" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl animate-fade-in p-4 sm:p-6">
      <PageHeader
        title="Gestión de caja"
        description={formatDate(today)}
        actions={
          caja && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
              <span className="h-2 w-2 animate-pulse rounded-full bg-green-600" aria-hidden="true" />
              CAJA ABIERTA
            </span>
          )
        }
      />

      <SegmentedControl
        label="Sección de caja"
        value={activeTab}
        onChange={setActiveTab}
        className="mb-5"
        options={[
          { value: 'turno', label: 'Turno actual' },
          { value: 'historial', label: 'Historial', count: historial.length },
        ]}
      />

      {activeTab === 'turno' && (
        <>
          {!caja ? (
            <div className="flex min-h-[320px] items-center justify-center">
              <form
                className="card w-full max-w-md p-6 text-center shadow-lg sm:p-8"
                onSubmit={(e) => {
                  e.preventDefault()
                  handleAbrirCaja()
                }}
              >
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-700/10 text-primary-700">
                  <Wallet className="h-8 w-8" aria-hidden="true" />
                </div>
                <h2 className="mb-1 text-xl font-bold text-fg">No hay caja abierta</h2>
                <p className="mb-6 text-sm text-fg-muted">Ingresa el monto de apertura para comenzar el turno</p>
                <Field label="Monto de apertura (S/)" className="mb-5 text-left">
                  {(p) => (
                    <input
                      {...p}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={0.01}
                      value={montoApertura}
                      onChange={(e) => setMontoApertura(parseFloat(e.target.value) || 0)}
                      className="input-field"
                      placeholder="0.00"
                    />
                  )}
                </Field>
                <Button type="submit" size="lg" block loading={abriendo}>
                  {abriendo ? 'Abriendo…' : 'Abrir caja'}
                </Button>
              </form>
            </div>
          ) : (
            <div className="space-y-4">
              <section className="card p-4 shadow-md sm:p-6" aria-label="Turno actual">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-fg-muted">
                      Apertura: <span className="font-medium text-fg">{formatDateTime(caja.opened_at)}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-fg-subtle">Fecha de turno: {formatDate(caja.fecha)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wide text-fg-muted">Monto apertura</p>
                    <p className="font-display text-2xl font-bold tabular-nums text-primary-700">{formatCurrency(caja.monto_apertura)}</p>
                  </div>
                </div>

                <div className="border-t border-line pt-4">
                  <h3 className="mb-3 text-sm font-semibold text-fg-muted">Resumen del turno</h3>

                  {resumenLoading ? (
                    <div className="space-y-2" aria-busy="true">
                      <Skeleton className="h-14 w-full" />
                      <Skeleton className="h-14 w-full" />
                      <Skeleton className="h-14 w-full" />
                    </div>
                  ) : resumenError ? (
                    <EmptyState
                      icon={AlertTriangle}
                      title="No se pudo cargar el resumen"
                      action={
                        <Button variant="secondary" onClick={() => refetchResumen()}>
                          Reintentar
                        </Button>
                      }
                    />
                  ) : (
                    <div className="space-y-3">
                      <div className="rounded-lg bg-primary-700 px-4 py-3 text-white">
                        <p className="text-xs uppercase tracking-wide text-primary-100">Efectivo esperado en el cajón</p>
                        <p className="text-2xl font-bold tabular-nums">{formatCurrency(esperado)}</p>
                        <p className="text-xs text-primary-100">
                          {formatCurrency(caja.monto_apertura)} de apertura {totales.efectivo < 0 ? '−' : '+'} {formatCurrency(Math.abs(totales.efectivo))} en efectivo del turno
                        </p>
                      </div>

                      {medios.length === 0 ? (
                        <p className="rounded-lg bg-muted px-4 py-3 text-sm text-fg-muted">Aún no hay cobros en este turno.</p>
                      ) : (
                        <div className="overflow-x-auto rounded-lg border border-line">
                          <table className="w-full text-sm">
                            <caption className="sr-only">Cobros del turno por medio de pago</caption>
                            <thead className="bg-muted text-xs uppercase tracking-wide text-fg-muted">
                              <tr>
                                <th scope="col" className="px-2 py-2 sm:px-3 text-left font-semibold">Medio</th>
                                <th scope="col" className="px-2 py-2 sm:px-3 text-right font-semibold">Ingresos</th>
                                <th scope="col" className="px-2 py-2 sm:px-3 text-right font-semibold">Anuladas</th>
                                <th scope="col" className="px-2 py-2 sm:px-3 text-right font-semibold">Neto</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                              {medios.map((m) => (
                                <tr key={m.medio}>
                                  <th scope="row" className="px-2 py-2 sm:px-3 text-left font-medium text-fg">
                                    {formatMedioPago(m.medio)}
                                    {m.medio === 'efectivo' && <span className="ml-1.5 hidden rounded sm:inline-block bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200">cajón</span>}
                                  </th>
                                  <td className="px-2 py-2 sm:px-3 text-right tabular-nums">{formatCurrency(m.ingresos)}</td>
                                  <td className="px-2 py-2 sm:px-3 text-right tabular-nums text-fg-muted">{m.egresos > 0 ? `−${formatCurrency(m.egresos)}` : '—'}</td>
                                  <td className="px-2 py-2 sm:px-3 text-right font-semibold tabular-nums">{formatCurrency(m.neto)}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="border-t-2 border-line bg-muted font-semibold">
                              <tr>
                                <th scope="row" className="px-2 py-2 sm:px-3 text-left">Total</th>
                                <td className="px-2 py-2 sm:px-3 text-right tabular-nums">{formatCurrency(totales.ingresos)}</td>
                                <td className="px-2 py-2 sm:px-3 text-right tabular-nums">{totales.egresos > 0 ? `−${formatCurrency(totales.egresos)}` : '—'}</td>
                                <td className="px-2 py-2 sm:px-3 text-right tabular-nums">{formatCurrency(totales.total)}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}

                      <p className="text-xs text-fg-muted">
                        Solo el efectivo se cuenta en el cajón. Yape, Plin, tarjeta y transferencia son informativos: compáralos con tu billetera o banco.
                      </p>

                      {(resumen?.credito_por_cobrar ?? 0) > 0 && (
                        <p className="flex items-center justify-between rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                          <span>A crédito en este turno (por cobrar)</span>
                          <span className="font-semibold tabular-nums">{formatCurrency(resumen?.credito_por_cobrar ?? 0)}</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-5">
                  <Button variant="danger" block onClick={() => setShowCerrarForm(true)}>
                    <Lock className="h-4 w-4" aria-hidden="true" />
                    Cerrar caja
                  </Button>
                </div>
              </section>
            </div>
          )}
        </>
      )}

      {activeTab === 'historial' && (
        <DataTable
          caption="Cajas cerradas"
          columns={columnasHistorial}
          rows={historial}
          rowKey={(c) => c.id}
          loading={loadingHistorial}
          skeletonRows={3}
          empty={<EmptyState icon={ClipboardList} title="No hay cajas cerradas aún" description="Cuando cierres tu primer turno aparecerá aquí con su diferencia." />}
        />
      )}

      {/* Cierre de caja */}
      {caja && (
        <Modal
          open={showCerrarForm}
          onOpenChange={(open) => !open && cerrarModalCierre()}
          title="Confirmar cierre de caja"
          description="Cuenta el efectivo del cajón antes de confirmar."
          persistent={cerrando}
          footer={
            <>
              <Button variant="secondary" onClick={cerrarModalCierre} disabled={cerrando}>
                Cancelar
              </Button>
              <Button type="submit" form="cierre-caja-form" variant="danger" loading={cerrando}>
                {cerrando ? 'Cerrando…' : 'Confirmar cierre'}
              </Button>
            </>
          }
        >
          <form
            id="cierre-caja-form"
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              handleCerrarCaja()
            }}
          >
            {!resumenLoading && (
              <div role="note" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <p className="mb-0.5 font-semibold">¿Cuánto contar?</p>
                <p>
                  Cuenta solo el <strong>efectivo</strong> del cajón (billetes y monedas). Deberías tener <strong>{formatCurrency(esperado)}</strong> (
                  {formatCurrency(caja.monto_apertura)} de apertura {totales.efectivo < 0 ? '−' : '+'} {formatCurrency(Math.abs(totales.efectivo))} en efectivo del turno).
                </p>
              </div>
            )}

            <Field label="Total de efectivo contado en el cajón (S/)" hint="Ingresa el total físico del cajón, sin contar Yape, Plin, tarjeta ni transferencias">
              {(p) => (
                <input
                  {...p}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.01}
                  value={montoReal}
                  onChange={(e) => setMontoReal(parseFloat(e.target.value) || 0)}
                  className="input-field text-lg font-semibold"
                  placeholder="0.00"
                  autoFocus
                />
              )}
            </Field>

            <Field label="Observaciones (opcional)">
              {(p) => (
                <textarea {...p} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} className="input-field resize-none" rows={3} placeholder="Notas del cierre..." />
              )}
            </Field>

            {!resumenLoading && (
              <dl className="space-y-1.5 rounded-lg bg-muted p-4 text-sm">
                <div className="flex justify-between text-fg-muted">
                  <dt>Apertura</dt>
                  <dd className="font-medium text-fg">{formatCurrency(caja.monto_apertura)}</dd>
                </div>
                <div className="flex justify-between text-fg-muted">
                  <dt>Efectivo del turno (neto)</dt>
                  <dd className="font-medium text-fg">{formatCurrency(totales.efectivo)}</dd>
                </div>
                <div className="flex justify-between border-t border-line pt-1.5 text-fg-muted">
                  <dt>Efectivo esperado</dt>
                  <dd className="font-semibold text-fg">{formatCurrency(esperado)}</dd>
                </div>
                <div className="flex justify-between text-fg-muted">
                  <dt>Digitales (no se cuentan)</dt>
                  <dd className="font-medium text-fg">{formatCurrency(totales.digital)}</dd>
                </div>
              </dl>
            )}

            {!resumenLoading && (
              <div className="flex justify-between rounded-lg bg-muted px-4 py-3 text-sm" role="status" aria-live="polite">
                <span className="font-semibold text-fg">{diferencia === 0 ? 'Cuadra' : diferencia > 0 ? 'Sobra' : 'Falta'}</span>
                <span className={cn('font-bold', diferencia >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300')}>
                  {formatCurrency(Math.abs(diferencia))}
                </span>
              </div>
            )}
          </form>
        </Modal>
      )}
    </div>
  )
}
