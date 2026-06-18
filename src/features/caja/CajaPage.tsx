import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import { formatCurrency, formatDate, formatDateTime } from '@/shared/utils/formatters'
import type { Database } from '@/shared/types/database'

type CajaRow = Database['public']['Tables']['cajas']['Row']

interface VentasResumen {
  count: number
  total: number
}

export default function CajaPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [montoApertura, setMontoApertura] = useState<number>(0)
  const [abriendo, setAbriendo] = useState(false)

  const [showCerrarForm, setShowCerrarForm] = useState(false)
  const [montoReal, setMontoReal] = useState<number>(0)
  const [observaciones, setObservaciones] = useState('')
  const [cerrando, setCerrando] = useState(false)

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
  })

  const { data: ventasResumen, isLoading: loadingVentas } = useQuery<VentasResumen>({
    queryKey: ['ventas-caja', caja?.id],
    queryFn: async () => {
      if (!caja?.id) return { count: 0, total: 0 }
      const { data, error } = await supabase
        .from('ventas')
        .select('total')
        .eq('caja_id', caja.id)
        .eq('estado', 'emitida')
      if (error) throw error
      const count = data?.length ?? 0
      const total = data?.reduce((sum, v) => sum + Number(v.total ?? 0), 0) ?? 0
      return { count, total }
    },
    enabled: !!caja?.id,
  })

  const { data: serviciosResumen, isLoading: loadingServicios } = useQuery<VentasResumen>({
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
      const count = data?.length ?? 0
      const total = data?.reduce((sum, s) => sum + Number(s.total ?? 0), 0) ?? 0
      return { count, total }
    },
    enabled: !!caja,
  })

  async function handleAbrirCaja() {
    if (!user) return
    setAbriendo(true)
    try {
      const { error } = await supabase.rpc('abrir_caja', {
        p_monto_apertura: montoApertura,
      })
      if (error) throw error
      await queryClient.invalidateQueries({ queryKey: ['caja-activa', user.sucursal_id] })
      toast.success('Caja abierta exitosamente')
    } catch (err) {
      toast.error('Error al abrir la caja')
      console.error(err)
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
      await queryClient.invalidateQueries({ queryKey: ['caja-activa', user?.sucursal_id] })
      await queryClient.invalidateQueries({ queryKey: ['ventas-caja', caja.id] })
      toast.success('Caja cerrada correctamente')
      setShowCerrarForm(false)
      setMontoReal(0)
      setObservaciones('')
    } catch (err) {
      toast.error('Error al cerrar la caja')
      console.error(err)
    } finally {
      setCerrando(false)
    }
  }

  const today = new Date().toISOString()

  if (loadingCaja) {
    return (
      <div className="animate-fade-in p-6">
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
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#1F3864]">Gestión de Caja</h1>
        <p className="text-sm text-gray-500 mt-1">{formatDate(today)}</p>
      </div>

      {!caja ? (
        /* ── ABRIR CAJA ─────────────────────────────────────────────── */
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <div className="card p-10 w-full max-w-md text-center shadow-lg">
            {/* Cash register illustration */}
            <div className="flex justify-center mb-6">
              <svg
                className="w-20 h-20 text-[#1F3864] opacity-80"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 64 64"
                strokeWidth={1.5}
              >
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
              ) : (
                'Abrir Caja'
              )}
            </button>
          </div>
        </div>
      ) : (
        /* ── CAJA ABIERTA ────────────────────────────────────────────── */
        <div className="space-y-6">
          {/* Status card */}
          <div className="card p-6 shadow-md">
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  CAJA ABIERTA
                </span>
                <p className="mt-2 text-sm text-gray-500">
                  Apertura: <span className="font-medium text-gray-700">{formatDateTime(caja.opened_at)}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Monto apertura</p>
                <p className="text-2xl font-bold text-[#1F3864]">
                  {formatCurrency(caja.monto_apertura)}
                </p>
              </div>
            </div>

            {/* Resumen del turno */}
            <div className="border-t border-gray-100 pt-4 mt-4">
              <h3 className="text-sm font-semibold text-gray-600 mb-3">Resumen del turno</h3>
              {(loadingVentas || loadingServicios) ? (
                <div className="space-y-2">
                  <div className="h-12 bg-gray-100 rounded animate-pulse" />
                  <div className="h-12 bg-gray-100 rounded animate-pulse" />
                  <div className="h-14 bg-gray-100 rounded animate-pulse" />
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Ventas POS */}
                  <div className="flex items-center justify-between px-4 py-3 bg-sky-50 rounded-lg">
                    <div>
                      <p className="text-sm font-semibold text-sky-700">Ventas POS</p>
                      <p className="text-xs text-gray-400">{ventasResumen?.count ?? 0} transacciones</p>
                    </div>
                    <p className="text-lg font-bold text-sky-700">
                      {formatCurrency(ventasResumen?.total ?? 0)}
                    </p>
                  </div>
                  {/* Servicios */}
                  <div className="flex items-center justify-between px-4 py-3 bg-emerald-50 rounded-lg">
                    <div>
                      <p className="text-sm font-semibold text-emerald-700">Servicios / Atenciones</p>
                      <p className="text-xs text-gray-400">{serviciosResumen?.count ?? 0} atenciones</p>
                    </div>
                    <p className="text-lg font-bold text-emerald-700">
                      {formatCurrency(serviciosResumen?.total ?? 0)}
                    </p>
                  </div>
                  {/* Total */}
                  <div className="flex items-center justify-between px-4 py-3 bg-[#1F3864] rounded-lg">
                    <p className="text-sm font-semibold text-white">Total recaudado</p>
                    <p className="text-xl font-bold text-white">
                      {formatCurrency((ventasResumen?.total ?? 0) + (serviciosResumen?.total ?? 0))}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Cerrar caja button */}
            {!showCerrarForm && (
              <div className="mt-6">
                <button
                  onClick={() => setShowCerrarForm(true)}
                  className="btn-danger w-full"
                >
                  Cerrar Caja
                </button>
              </div>
            )}
          </div>

          {/* Cerrar Caja inline form */}
          {showCerrarForm && (
            <div className="card p-6 shadow-md border-l-4 border-red-400">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Cerrar Caja</h3>

              <div className="space-y-4">
                <div>
                  <label className="label-text">Monto real en caja (S/)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={montoReal}
                    onChange={(e) => setMontoReal(parseFloat(e.target.value) || 0)}
                    className="input-field"
                    placeholder="0.00"
                  />
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

                {/* Expected vs real preview */}
                {(() => {
                  const totalTurno = (ventasResumen?.total ?? 0) + (serviciosResumen?.total ?? 0)
                  const esperado = Number(caja.monto_apertura) + totalTurno
                  const diferencia = montoReal - esperado
                  return (
                    <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Apertura:</span>
                        <span className="font-medium">{formatCurrency(caja.monto_apertura)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Ventas POS:</span>
                        <span className="font-medium">{formatCurrency(ventasResumen?.total ?? 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Servicios:</span>
                        <span className="font-medium">{formatCurrency(serviciosResumen?.total ?? 0)}</span>
                      </div>
                      <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
                        <span className="text-gray-700 font-semibold">Diferencia:</span>
                        <span className={`font-bold ${diferencia >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(diferencia)}
                        </span>
                      </div>
                    </div>
                  )
                })()}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleCerrarCaja}
                    disabled={cerrando}
                    className="btn-danger flex-1 disabled:opacity-60"
                  >
                    {cerrando ? 'Cerrando...' : 'Confirmar Cierre'}
                  </button>
                  <button
                    onClick={() => {
                      setShowCerrarForm(false)
                      setMontoReal(0)
                      setObservaciones('')
                    }}
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
    </div>
  )
}
