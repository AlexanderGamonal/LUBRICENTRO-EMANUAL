import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import { formatCurrency, formatDate, formatDateTime } from '@/shared/utils/formatters'
import type { Database } from '@/shared/types/database'

type CajaRow = Database['public']['Tables']['cajas']['Row']

interface Resumen {
  count: number
  total: number
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
  })

  /* ── Ventas del turno ────────────────────────────────────── */
  const {
    data: ventasResumen,
    isLoading: loadingVentas,
    isError: errorVentas,
    refetch: refetchVentas,
  } = useQuery<Resumen>({
    queryKey: ['ventas-caja', caja?.id],
    queryFn: async () => {
      if (!caja?.id) return { count: 0, total: 0 }
      const { data, error } = await supabase
        .from('ventas')
        .select('total')
        .eq('caja_id', caja.id)
        .eq('estado', 'emitida')
      if (error) throw error
      return {
        count: data?.length ?? 0,
        total: data?.reduce((s, v) => s + Number(v.total ?? 0), 0) ?? 0,
      }
    },
    enabled: !!caja?.id,
    retry: 1,
    staleTime: 30_000,
  })

  /* ── Servicios del turno (por fecha de la caja) ──────────── */
  const {
    data: serviciosResumen,
    isLoading: loadingServicios,
    isError: errorServicios,
    refetch: refetchServicios,
  } = useQuery<Resumen>({
    queryKey: ['servicios-caja-dia', caja?.sucursal_id, caja?.fecha],
    queryFn: async () => {
      if (!caja) return { count: 0, total: 0 }
      const { data, error } = await supabase
        .from('servicios')
        .select('total')
        .eq('sucursal_id', caja.sucursal_id)
        .eq('fecha_servicio', caja.fecha)
        .eq('estado', 'terminado')
      if (error) throw error
      return {
        count: data?.length ?? 0,
        total: data?.reduce((s, sv) => s + Number(sv.total ?? 0), 0) ?? 0,
      }
    },
    enabled: !!caja,
    retry: 1,
    staleTime: 30_000,
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
      await queryClient.invalidateQueries({ queryKey: ['ventas-caja'] })
      await queryClient.invalidateQueries({ queryKey: ['servicios-caja-dia'] })
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

  const today = new Date().toISOString()
  const resumenLoading = loadingVentas || loadingServicios
  const totalTurno = (ventasResumen?.total ?? 0) + (serviciosResumen?.total ?? 0)

  /* ── Loading inicial ──────────────────────────────────────── */
  if (loadingCaja) {
    return (
      <div className="animate-fade-in p-6 max-w-3xl mx-auto">
        <div className="mb-6">
          <div className="h-8 w-56 bg-gray-200 rounded animate-pulse mb-2" />
          <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="card p-8">
          <div className="h-40 bg-gray-100 rounded animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1F3864]">Gestión de Caja</h1>
          <p className="text-sm text-gray-500 mt-1">{formatDate(today)}</p>
        </div>
        {caja && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            CAJA ABIERTA
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        {(['turno', 'historial'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === tab
                ? 'bg-white text-[#1F3864] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'turno' ? 'Turno Actual' : 'Historial'}
            {tab === 'historial' && historial.length > 0 && (
              <span className="ml-1.5 text-xs bg-gray-200 text-gray-600 rounded-full px-1.5 py-0.5">
                {historial.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* TAB: TURNO ACTUAL                                      */}
      {/* ═══════════════════════════════════════════════════════ */}
      {activeTab === 'turno' && (
        <>
          {!caja ? (
            /* ── Abrir Caja ──────────────────────────────────── */
            <div className="flex flex-col items-center justify-center min-h-[360px]">
              <div className="card p-10 w-full max-w-md text-center shadow-lg">
                <div className="flex justify-center mb-6">
                  <svg className="w-20 h-20 text-[#1F3864] opacity-80" fill="none" stroke="currentColor" viewBox="0 0 64 64" strokeWidth={1.5}>
                    <rect x="8" y="20" width="48" height="32" rx="4" strokeLinejoin="round" />
                    <rect x="14" y="36" width="36" height="10" rx="2" strokeLinejoin="round" />
                    <path d="M20 20V14a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v6" strokeLinejoin="round" />
                    <circle cx="32" cy="29" r="4" />
                    <line x1="20" y1="52" x2="20" y2="56" />
                    <line x1="44" y1="52" x2="44" y2="56" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-1">No hay caja abierta</h2>
                <p className="text-sm text-gray-500 mb-8">
                  Ingresa el monto de apertura para comenzar el turno
                </p>
                <div className="text-left mb-6">
                  <label className="label-text">Monto de apertura (S/)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={montoApertura}
                    onChange={(e) => setMontoApertura(parseFloat(e.target.value) || 0)}
                    className="input-field"
                    placeholder="0.00"
                  />
                </div>
                <button
                  onClick={handleAbrirCaja}
                  disabled={abriendo}
                  className="w-full py-3 px-6 text-white font-semibold rounded-lg transition-opacity disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #1F3864, #0ea5e9)' }}
                >
                  {abriendo ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Abriendo...
                    </span>
                  ) : 'Abrir Caja'}
                </button>
              </div>
            </div>
          ) : (
            /* ── Caja abierta ────────────────────────────────── */
            <div className="space-y-4">
              {/* Status + apertura */}
              <div className="card p-6 shadow-md">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-sm text-gray-500">
                      Apertura: <span className="font-medium text-gray-700">{formatDateTime(caja.opened_at)}</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">Fecha de turno: {formatDate(caja.fecha)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Monto apertura</p>
                    <p className="text-2xl font-bold text-[#1F3864]">
                      {formatCurrency(caja.monto_apertura)}
                    </p>
                  </div>
                </div>

                {/* Resumen del turno */}
                <div className="border-t border-gray-100 pt-4">
                  <h3 className="text-sm font-semibold text-gray-600 mb-3">Resumen del turno</h3>

                  {resumenLoading ? (
                    <div className="space-y-2">
                      <div className="h-12 bg-gray-100 rounded animate-pulse" />
                      <div className="h-12 bg-gray-100 rounded animate-pulse" />
                      <div className="h-14 bg-gray-100 rounded animate-pulse" />
                    </div>
                  ) : (errorVentas && errorServicios) ? (
                    <div className="text-center py-4">
                      <p className="text-sm text-red-600 mb-3">No se pudo cargar el resumen</p>
                      <button
                        onClick={() => { refetchVentas(); refetchServicios() }}
                        className="px-4 py-2 text-sm font-medium text-white bg-[#1F3864] rounded-lg hover:opacity-90"
                      >
                        Reintentar
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* Ventas POS */}
                      <div className="flex items-center justify-between px-4 py-3 bg-sky-50 rounded-lg">
                        <div>
                          <p className="text-sm font-semibold text-sky-700">Ventas POS</p>
                          <p className="text-xs text-gray-400">
                            {errorVentas ? (
                              <button onClick={() => refetchVentas()} className="text-red-500 underline">Error — Reintentar</button>
                            ) : (
                              `${ventasResumen?.count ?? 0} transacciones`
                            )}
                          </p>
                        </div>
                        <p className="text-lg font-bold text-sky-700">
                          {errorVentas ? '—' : formatCurrency(ventasResumen?.total ?? 0)}
                        </p>
                      </div>

                      {/* Servicios */}
                      <div className="flex items-center justify-between px-4 py-3 bg-emerald-50 rounded-lg">
                        <div>
                          <p className="text-sm font-semibold text-emerald-700">Servicios / Atenciones</p>
                          <p className="text-xs text-gray-400">
                            {errorServicios ? (
                              <button onClick={() => refetchServicios()} className="text-red-500 underline">Error — Reintentar</button>
                            ) : (
                              `${serviciosResumen?.count ?? 0} atenciones`
                            )}
                          </p>
                        </div>
                        <p className="text-lg font-bold text-emerald-700">
                          {errorServicios ? '—' : formatCurrency(serviciosResumen?.total ?? 0)}
                        </p>
                      </div>

                      {/* Total */}
                      <div className="flex items-center justify-between px-4 py-3 bg-[#1F3864] rounded-lg">
                        <p className="text-sm font-semibold text-white">Total recaudado</p>
                        <p className="text-xl font-bold text-white">
                          {formatCurrency(totalTurno)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {!showCerrarForm && (
                  <div className="mt-5">
                    <button onClick={() => setShowCerrarForm(true)} className="btn-danger w-full">
                      Cerrar Caja
                    </button>
                  </div>
                )}
              </div>

              {/* Cerrar Caja form */}
              {showCerrarForm && (
                <div className="card p-6 shadow-md border-l-4 border-red-400">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">Confirmar Cierre de Caja</h3>
                  <div className="space-y-4">
                    {/* Instrucción de conteo */}
                    {!resumenLoading && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                        <p className="font-semibold text-amber-800 mb-0.5">¿Cuánto contar?</p>
                        <p className="text-amber-700">
                          Cuenta <strong>todos</strong> los billetes y monedas del cajón.
                          Deberías tener aproximadamente{' '}
                          <strong>{formatCurrency(Number(caja.monto_apertura) + totalTurno)}</strong>
                          {' '}(S/ {formatCurrency(caja.monto_apertura)} de apertura + S/ {formatCurrency(totalTurno)} de ventas/servicios).
                        </p>
                      </div>
                    )}
                    <div>
                      <label className="label-text">Total de efectivo contado en el cajón (S/)</label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={montoReal}
                        onChange={(e) => setMontoReal(parseFloat(e.target.value) || 0)}
                        className="input-field"
                        placeholder="0.00"
                      />
                      <p className="text-xs text-gray-400 mt-1">Ingresa el total físico: apertura + lo recaudado durante el turno</p>
                    </div>
                    <div>
                      <label className="label-text">Observaciones (opcional)</label>
                      <textarea
                        value={observaciones}
                        onChange={(e) => setObservaciones(e.target.value)}
                        className="input-field resize-none"
                        rows={3}
                        placeholder="Notas del cierre..."
                      />
                    </div>

                    {/* Resumen cierre */}
                    {!resumenLoading && (
                      <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1.5">
                        <div className="flex justify-between text-gray-500">
                          <span>Apertura:</span>
                          <span className="font-medium text-gray-700">{formatCurrency(caja.monto_apertura)}</span>
                        </div>
                        <div className="flex justify-between text-gray-500">
                          <span>Ventas POS:</span>
                          <span className="font-medium text-gray-700">{formatCurrency(ventasResumen?.total ?? 0)}</span>
                        </div>
                        <div className="flex justify-between text-gray-500">
                          <span>Servicios:</span>
                          <span className="font-medium text-gray-700">{formatCurrency(serviciosResumen?.total ?? 0)}</span>
                        </div>
                        <div className="flex justify-between text-gray-500 border-t border-gray-200 pt-1.5">
                          <span>Esperado en caja:</span>
                          <span className="font-semibold text-gray-700">
                            {formatCurrency(Number(caja.monto_apertura) + totalTurno)}
                          </span>
                        </div>
                        <div className="flex justify-between border-t border-gray-200 pt-1.5">
                          <span className="font-semibold text-gray-700">Diferencia:</span>
                          <span className={`font-bold ${(montoReal - (Number(caja.monto_apertura) + totalTurno)) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(montoReal - (Number(caja.monto_apertura) + totalTurno))}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3 pt-1">
                      <button onClick={handleCerrarCaja} disabled={cerrando} className="btn-danger flex-1 disabled:opacity-60">
                        {cerrando ? 'Cerrando...' : 'Confirmar Cierre'}
                      </button>
                      <button
                        onClick={() => { setShowCerrarForm(false); setMontoReal(0); setObservaciones('') }}
                        className="btn-secondary flex-1"
                        disabled={cerrando}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* TAB: HISTORIAL                                         */}
      {/* ═══════════════════════════════════════════════════════ */}
      {activeTab === 'historial' && (
        <div>
          {loadingHistorial ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : historial.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm">No hay cajas cerradas aún</p>
            </div>
          ) : (
            <div className="space-y-3">
              {historial.map((c) => {
                const ingresos = Number(c.monto_cierre_esperado ?? 0) - Number(c.monto_apertura)
                const dif = Number(c.diferencia ?? 0)
                return (
                  <div key={c.id} className="card p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-4">
                      {/* Fecha + duración */}
                      <div className="min-w-0">
                        <p className="font-bold text-[#1F3864] text-base">{formatDate(c.fecha)}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {formatDateTime(c.opened_at)} → {c.closed_at ? formatDateTime(c.closed_at) : '—'}
                          <span className="ml-2 font-medium text-gray-500">({duracion(c.opened_at, c.closed_at)})</span>
                        </p>
                        {c.observaciones && (
                          <p className="text-xs text-gray-500 mt-1 italic">"{c.observaciones}"</p>
                        )}
                      </div>
                      {/* Diferencia badge */}
                      <span className={`shrink-0 text-sm font-bold px-3 py-1 rounded-full ${
                        dif > 0 ? 'bg-green-100 text-green-700' :
                        dif < 0 ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {dif >= 0 ? '+' : ''}{formatCurrency(dif)}
                      </span>
                    </div>

                    {/* Montos */}
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div className="bg-gray-50 rounded-lg px-2 py-2">
                        <p className="text-xs text-gray-400">Apertura</p>
                        <p className="text-sm font-semibold text-gray-700">{formatCurrency(c.monto_apertura)}</p>
                      </div>
                      <div className="bg-sky-50 rounded-lg px-2 py-2">
                        <p className="text-xs text-sky-500">Ingresos</p>
                        <p className="text-sm font-semibold text-sky-700">{formatCurrency(ingresos)}</p>
                      </div>
                      <div className={`rounded-lg px-2 py-2 ${
                        dif >= 0 ? 'bg-green-50' : 'bg-red-50'
                      }`}>
                        <p className={`text-xs ${dif >= 0 ? 'text-green-500' : 'text-red-400'}`}>Real contado</p>
                        <p className={`text-sm font-semibold ${dif >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {c.monto_cierre_real != null ? formatCurrency(c.monto_cierre_real) : '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
