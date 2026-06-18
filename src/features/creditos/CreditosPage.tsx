import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import { formatCurrency, formatDate } from '@/shared/utils/formatters'
import type { Database } from '@/shared/types/database'

type EstadoCredito = Database['public']['Enums']['estado_credito']
type MedioPago = Database['public']['Enums']['medio_pago']

interface CreditoConCliente {
  id: string
  sucursal_id: string
  cliente_id: string
  venta_id: string | null
  monto_total: number
  monto_pagado: number
  saldo: number
  estado: EstadoCredito
  fecha_vencimiento: string | null
  created_at: string
  updated_at: string
  clientes: { nombre: string; telefono: string | null } | null
}

type TabFilter = 'todos' | 'pendiente' | 'parcial' | 'vencido'

const MEDIOS_PAGO: { value: MedioPago; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'yape', label: 'Yape' },
  { value: 'plin', label: 'Plin' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'transferencia', label: 'Transferencia' },
]

function EstadoBadge({ estado }: { estado: EstadoCredito }) {
  const styles: Record<EstadoCredito, string> = {
    pendiente: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    parcial: 'bg-orange-100 text-orange-700 border-orange-200',
    pagado: 'bg-green-100 text-green-700 border-green-200',
    vencido: 'bg-red-100 text-red-700 border-red-200',
  }
  const labels: Record<EstadoCredito, string> = {
    pendiente: 'Pendiente',
    parcial: 'Parcial',
    pagado: 'Pagado',
    vencido: 'Vencido',
  }
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[estado]}`}
    >
      {labels[estado]}
    </span>
  )
}

interface PagoModalProps {
  credito: CreditoConCliente
  onClose: () => void
  onSuccess: () => void
}

function PagoModal({ credito, onClose, onSuccess }: PagoModalProps) {
  const [monto, setMonto] = useState<number>(credito.saldo)
  const [medioPago, setMedioPago] = useState<MedioPago>('efectivo')
  const [referencia, setReferencia] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [montoError, setMontoError] = useState('')

  const clienteNombre = credito.clientes?.nombre ?? 'Cliente'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMontoError('')

    if (!monto || monto <= 0) {
      setMontoError('El monto debe ser mayor a 0')
      return
    }
    if (monto > credito.saldo) {
      setMontoError(`El monto no puede superar el saldo (${formatCurrency(credito.saldo)})`)
      return
    }

    setSubmitting(true)
    try {
      const { error } = await supabase.rpc('registrar_pago_credito', {
        p_credito_id: credito.id,
        p_monto: monto,
        p_medio_pago: medioPago,
        p_referencia: referencia.trim() || null,
      })
      if (error) throw error
      toast.success(`Pago de ${formatCurrency(monto)} registrado correctamente`)
      onSuccess()
    } catch (err) {
      toast.error('Error al registrar el pago')
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal header */}
          <div
            className="px-6 py-4 rounded-t-2xl flex items-center justify-between"
            style={{ background: 'linear-gradient(135deg, #1F3864, #0ea5e9)' }}
          >
            <div>
              <h2 className="text-lg font-bold text-white">Registrar Pago</h2>
              <p className="text-white/80 text-sm">{clienteNombre}</p>
            </div>
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round" strokeWidth={2} />
                <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" strokeWidth={2} />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Saldo info */}
            <div className="bg-gray-50 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Saldo actual</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(credito.saldo)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Total crédito</p>
                <p className="text-sm font-medium text-gray-700">{formatCurrency(credito.monto_total)}</p>
                <p className="text-xs text-gray-400">Pagado: {formatCurrency(credito.monto_pagado)}</p>
              </div>
            </div>

            {/* Monto */}
            <div>
              <label className="label-text">
                Monto a pagar (S/) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={0.01}
                max={credito.saldo}
                step={0.01}
                value={monto}
                onChange={(e) => {
                  setMonto(parseFloat(e.target.value) || 0)
                  setMontoError('')
                }}
                className="input-field"
                placeholder="0.00"
                autoFocus
              />
              {montoError && <p className="error-text mt-1">{montoError}</p>}
              <button
                type="button"
                onClick={() => setMonto(credito.saldo)}
                className="text-xs text-sky-600 hover:text-sky-700 mt-1 transition-colors"
              >
                Pagar saldo completo ({formatCurrency(credito.saldo)})
              </button>
            </div>

            {/* Medio de pago */}
            <div>
              <label className="label-text">
                Medio de pago <span className="text-red-500">*</span>
              </label>
              <select
                value={medioPago}
                onChange={(e) => setMedioPago(e.target.value as MedioPago)}
                className="input-field"
              >
                {MEDIOS_PAGO.map((mp) => (
                  <option key={mp.value} value={mp.value}>
                    {mp.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Referencia */}
            <div>
              <label className="label-text">Referencia / Comprobante (opcional)</label>
              <input
                type="text"
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                className="input-field"
                placeholder="Ej: N° operación, número de voucher..."
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary flex-1"
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2.5 px-4 text-white font-semibold rounded-lg transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #1F3864, #0ea5e9)' }}
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Registrando...
                  </>
                ) : (
                  'Registrar Pago'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

export default function CreditosPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<TabFilter>('todos')
  const [selectedCredito, setSelectedCredito] = useState<CreditoConCliente | null>(null)

  const { data: creditos = [], isLoading } = useQuery<CreditoConCliente[]>({
    queryKey: ['creditos', user?.sucursal_id],
    queryFn: async () => {
      if (!user?.sucursal_id) return []
      const { data, error } = await supabase
        .from('creditos_cliente')
        .select('*, clientes(nombre, telefono)')
        .eq('sucursal_id', user.sucursal_id)
        .neq('estado', 'pagado')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as CreditoConCliente[]
    },
    enabled: !!user?.sucursal_id,
  })

  const filtered = useMemo(() => {
    if (activeTab === 'todos') return creditos
    return creditos.filter((c) => c.estado === activeTab)
  }, [creditos, activeTab])

  const saldoTotal = useMemo(
    () => creditos.reduce((sum, c) => sum + c.saldo, 0),
    [creditos]
  )
  const saldoVencido = useMemo(
    () => creditos.filter((c) => c.estado === 'vencido').reduce((sum, c) => sum + c.saldo, 0),
    [creditos]
  )

  const tabs: { value: TabFilter; label: string }[] = [
    { value: 'todos', label: 'Todos' },
    { value: 'pendiente', label: 'Pendientes' },
    { value: 'parcial', label: 'Parciales' },
    { value: 'vencido', label: 'Vencidos' },
  ]

  function handlePagoSuccess() {
    queryClient.invalidateQueries({ queryKey: ['creditos', user?.sucursal_id] })
    setSelectedCredito(null)
  }

  return (
    <div className="animate-fade-in p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1F3864]">Créditos</h1>
        <p className="text-sm text-gray-500 mt-0.5">Gestión de cuentas por cobrar</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Créditos activos</p>
              <p className="text-2xl font-bold text-[#1F3864]">{creditos.length}</p>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Saldo pendiente</p>
              <p className="text-xl font-bold text-yellow-600">{formatCurrency(saldoTotal)}</p>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Saldo vencido</p>
              <p className="text-xl font-bold text-red-600">{formatCurrency(saldoVencido)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {tabs.map((tab) => {
          const count =
            tab.value === 'todos'
              ? creditos.length
              : creditos.filter((c) => c.estado === tab.value).length
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeTab === tab.value
                  ? 'bg-white text-[#1F3864] shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span
                  className={`ml-1.5 text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                    activeTab === tab.value ? 'bg-[#1F3864]/10 text-[#1F3864]' : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="premium-table w-full">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Monto Total
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Pagado
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Saldo
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Vencimiento
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(7)].map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-200 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <svg
                        className="w-16 h-16 text-gray-300 mb-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 64 64"
                        strokeWidth={1.2}
                      >
                        <rect x="10" y="14" width="44" height="36" rx="4" />
                        <line x1="20" y1="26" x2="44" y2="26" strokeLinecap="round" />
                        <line x1="20" y1="34" x2="36" y2="34" strokeLinecap="round" />
                        <path d="M40 38l4 4 8-8" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} />
                      </svg>
                      <p className="text-gray-500 font-medium">No hay créditos {activeTab !== 'todos' ? `en estado "${activeTab}"` : 'activos'}</p>
                      <p className="text-gray-400 text-sm mt-0.5">Los créditos pagados se archivan automáticamente</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((credito) => (
                  <tr key={credito.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {credito.clientes?.nombre ?? '—'}
                      </div>
                      {credito.clientes?.telefono && (
                        <div className="text-xs text-gray-400 mt-0.5">
                          {credito.clientes.telefono}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                      {formatCurrency(credito.monto_total)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-green-600 font-medium">
                      {formatCurrency(credito.monto_pagado)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-red-600">
                      {formatCurrency(credito.saldo)}
                    </td>
                    <td className="px-4 py-3">
                      <EstadoBadge estado={credito.estado} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {credito.fecha_vencimiento ? (
                        <span
                          className={
                            credito.estado === 'vencido' ? 'text-red-600 font-medium' : ''
                          }
                        >
                          {formatDate(credito.fecha_vencimiento)}
                        </span>
                      ) : (
                        <span className="text-gray-300 italic">Sin vencimiento</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelectedCredito(credito)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-md transition-opacity hover:opacity-90"
                        style={{ background: 'linear-gradient(135deg, #1F3864, #0ea5e9)' }}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Registrar Pago
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Modal */}
      {selectedCredito && (
        <PagoModal
          credito={selectedCredito}
          onClose={() => setSelectedCredito(null)}
          onSuccess={handlePagoSuccess}
        />
      )}
    </div>
  )
}
