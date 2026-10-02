import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import { formatCurrency, formatDate } from '@/shared/utils/formatters'
import { AlertTriangle, Banknote, CreditCard, HandCoins, Wallet } from 'lucide-react'
import { Button, DataTable, EmptyState, Field, Modal, SegmentedControl, StatCard } from '@/shared/ui'
import type { Column } from '@/shared/ui'
import { cn } from '@/shared/utils/cn'
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
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold', styles[estado])}>
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
    <Modal
      open
      onOpenChange={(open) => !open && !submitting && onClose()}
      title="Registrar pago"
      description={clienteNombre}
      persistent={submitting}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" form="pago-credito-form" loading={submitting}>
            {submitting ? 'Registrando…' : 'Registrar pago'}
          </Button>
        </>
      }
    >
      <form id="pago-credito-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center justify-between rounded-xl bg-muted p-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-fg-muted">Saldo actual</p>
            <p className="text-2xl font-bold text-red-700 dark:text-red-300">{formatCurrency(credito.saldo)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-fg-muted">Total crédito</p>
            <p className="text-sm font-medium text-fg">{formatCurrency(credito.monto_total)}</p>
            <p className="text-xs text-fg-subtle">Pagado: {formatCurrency(credito.monto_pagado)}</p>
          </div>
        </div>

        <Field label="Monto a pagar (S/)" required error={montoError}>
          {(p) => (
            <>
              <input
                {...p}
                type="number"
                inputMode="decimal"
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
              <button
                type="button"
                onClick={() => setMonto(credito.saldo)}
                className="mt-1 inline-flex min-h-touch items-center text-xs font-medium text-sky-700 hover:text-sky-800 md:min-h-0"
              >
                Pagar saldo completo ({formatCurrency(credito.saldo)})
              </button>
            </>
          )}
        </Field>

        <Field label="Medio de pago" required>
          {(p) => (
            <select {...p} value={medioPago} onChange={(e) => setMedioPago(e.target.value as MedioPago)} className="input-field">
              {MEDIOS_PAGO.map((mp) => (
                <option key={mp.value} value={mp.value}>
                  {mp.label}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field label="Referencia / comprobante (opcional)">
          {(p) => (
            <input
              {...p}
              type="text"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              className="input-field"
              placeholder="Ej: N° operación, número de voucher..."
            />
          )}
        </Field>
      </form>
    </Modal>
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

  const saldoTotal = useMemo(() => creditos.reduce((sum, c) => sum + c.saldo, 0), [creditos])
  const saldoVencido = useMemo(
    () => creditos.filter((c) => c.estado === 'vencido').reduce((sum, c) => sum + c.saldo, 0),
    [creditos],
  )

  const tabs: { value: TabFilter; label: string; count: number }[] = (
    [
      ['todos', 'Todos'],
      ['pendiente', 'Pendientes'],
      ['parcial', 'Parciales'],
      ['vencido', 'Vencidos'],
    ] as const
  ).map(([value, label]) => ({
    value,
    label,
    count: value === 'todos' ? creditos.length : creditos.filter((c) => c.estado === value).length,
  }))

  function handlePagoSuccess() {
    queryClient.invalidateQueries({ queryKey: ['creditos', user?.sucursal_id] })
    setSelectedCredito(null)
  }

  const columns: Column<CreditoConCliente>[] = [
    {
      key: 'cliente',
      header: 'Cliente',
      mobile: 'title',
      cell: (c) => (
        <div>
          <div className="font-medium text-fg">{c.clientes?.nombre ?? '—'}</div>
          {c.clientes?.telefono && <div className="mt-0.5 text-xs font-normal text-fg-subtle">{c.clientes.telefono}</div>}
        </div>
      ),
    },
    {
      key: 'total',
      header: 'Monto total',
      align: 'right',
      hideBelowLg: true,
      cell: (c) => <span className="font-medium text-fg">{formatCurrency(c.monto_total)}</span>,
    },
    {
      key: 'pagado',
      header: 'Pagado',
      align: 'right',
      hideBelowLg: true,
      cell: (c) => <span className="font-medium text-green-700">{formatCurrency(c.monto_pagado)}</span>,
    },
    {
      key: 'saldo',
      header: 'Saldo',
      align: 'right',
      cell: (c) => <span className="font-bold text-red-700 dark:text-red-300">{formatCurrency(c.saldo)}</span>,
    },
    { key: 'estado', header: 'Estado', cell: (c) => <EstadoBadge estado={c.estado} /> },
    {
      key: 'venc',
      header: 'Vencimiento',
      cell: (c) =>
        c.fecha_vencimiento ? (
          <span className={c.estado === 'vencido' ? 'font-medium text-red-700 dark:text-red-300' : undefined}>{formatDate(c.fecha_vencimiento)}</span>
        ) : (
          <span className="italic text-fg-subtle">Sin vencimiento</span>
        ),
    },
    {
      key: 'acciones',
      header: 'Acciones',
      mobile: 'actions',
      align: 'right',
      srOnlyHeader: true,
      cell: (c) => (
        <Button size="sm" onClick={() => setSelectedCredito(c)} className="w-full md:w-auto" aria-label={`Registrar pago de ${c.clientes?.nombre ?? 'cliente'}`}>
          <Banknote className="h-3.5 w-3.5" aria-hidden="true" />
          Registrar pago
        </Button>
      ),
    },
  ]

  return (
    <div className="animate-fade-in p-4 sm:p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-primary-700">Créditos</h1>
        <p className="mt-0.5 text-sm text-fg-muted">Gestión de cuentas por cobrar</p>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard label="Créditos activos" value={creditos.length} icon={CreditCard} tone="accent" loading={isLoading} />
        <StatCard label="Saldo pendiente" value={formatCurrency(saldoTotal)} icon={Wallet} tone="warning" loading={isLoading} />
        <StatCard label="Saldo vencido" value={formatCurrency(saldoVencido)} icon={AlertTriangle} tone="danger" loading={isLoading} />
      </div>

      <SegmentedControl label="Filtrar créditos por estado" options={tabs} value={activeTab} onChange={setActiveTab} className="mb-4" />

      <DataTable
        caption="Créditos pendientes de cobro"
        columns={columns}
        rows={filtered}
        rowKey={(c) => c.id}
        loading={isLoading}
        empty={
          <EmptyState
            icon={HandCoins}
            title={`No hay créditos ${activeTab !== 'todos' ? `en estado «${activeTab}»` : 'activos'}`}
            description="Los créditos pagados se archivan automáticamente."
          />
        }
      />

      {selectedCredito && (
        <PagoModal credito={selectedCredito} onClose={() => setSelectedCredito(null)} onSuccess={handlePagoSuccess} />
      )}
    </div>
  )
}
