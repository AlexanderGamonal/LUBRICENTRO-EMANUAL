import { useCallback, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import { cn } from '@/shared/utils/cn'
import { productoSchema } from '@/features/productos/schemas/productoSchema'
import type { Database } from '@/shared/types/database'

type Step = 1 | 2 | 3

interface FilaRaw {
  rowNum: number
  codigo_interno: string
  nombre: string
  precio_venta: number | string
  codigo_barras?: string
  marca?: string
  viscosidad_especificacion?: string
  stock_minimo?: number | string
  stock_inicial?: number | string
  costo?: number | string
}

interface FilaValidada {
  rowNum: number
  valida: boolean
  errores: string[]
  datos: FilaRaw
}

interface ResultadoImport {
  creados: number
  actualizados: number
  errores: number
  detalles: string[]
}

const MAX_SIZE_MB = 5

const PLANTILLA_HEADERS = [
  'codigo_interno',
  'nombre',
  'precio_venta',
  'codigo_barras',
  'marca',
  'viscosidad_especificacion',
  'stock_minimo',
  'stock_inicial',
  'costo',
]

function descargarPlantilla() {
  const wb = XLSX.utils.book_new()
  const wsData = [
    PLANTILLA_HEADERS,
    ['PRD-001', 'Aceite Mobil 20W-50 1L', 25.9, '', 'Mobil', '20W-50 API SL', 5, 10, 18],
    ['PRD-002', 'Filtro de aceite Toyota', 12.5, '', 'Toyota', '', 3, 5, 8],
  ]
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  ws['!cols'] = PLANTILLA_HEADERS.map(() => ({ wch: 22 }))
  XLSX.utils.book_append_sheet(wb, ws, 'Productos')
  XLSX.writeFile(wb, 'plantilla_productos.xlsx')
}

function normalizarClave(key: string): string {
  return key.toLowerCase().trim().replace(/\s+/g, '_')
}

function parsearFilas(data: Record<string, unknown>[]): FilaRaw[] {
  return data.map((row, i) => {
    const normalized: Record<string, unknown> = {}
    for (const key of Object.keys(row)) {
      normalized[normalizarClave(key)] = row[key]
    }
    return {
      rowNum: i + 2, // fila 1 = encabezados
      codigo_interno: String(normalized['codigo_interno'] ?? '').trim(),
      nombre: String(normalized['nombre'] ?? '').trim(),
      precio_venta: (normalized['precio_venta'] ?? '') as number | string,
      codigo_barras: String(normalized['codigo_barras'] ?? '').trim() || undefined,
      marca: String(normalized['marca'] ?? '').trim() || undefined,
      viscosidad_especificacion:
        String(normalized['viscosidad_especificacion'] ?? '').trim() || undefined,
      stock_minimo: (normalized['stock_minimo'] ?? 0) as number | string,
      stock_inicial: (normalized['stock_inicial'] ?? 0) as number | string,
      costo: (normalized['costo'] ?? 0) as number | string,
    }
  })
}

function validarFila(fila: FilaRaw): FilaValidada {
  const errores: string[] = []

  const result = productoSchema.safeParse({
    codigo_interno: fila.codigo_interno,
    nombre: fila.nombre,
    precio_venta:
      typeof fila.precio_venta === 'string'
        ? parseFloat(fila.precio_venta) || 0
        : Number(fila.precio_venta),
    costo:
      typeof fila.costo === 'string'
        ? parseFloat(fila.costo) || 0
        : Number(fila.costo ?? 0),
    stock_minimo: Number(fila.stock_minimo ?? 0),
    stock_inicial: Number(fila.stock_inicial ?? 0),
    codigo_barras: fila.codigo_barras ?? '',
    marca: fila.marca ?? '',
    viscosidad_especificacion: fila.viscosidad_especificacion ?? '',
  })

  if (!result.success) {
    for (const issue of result.error.issues) {
      errores.push(issue.message)
    }
  }

  return { rowNum: fila.rowNum, valida: errores.length === 0, errores, datos: fila }
}

export function ImportacionPage() {
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>(1)
  const [dragging, setDragging] = useState(false)
  const [filas, setFilas] = useState<FilaValidada[]>([])
  const [progreso, setProgreso] = useState(0)
  const [resultado, setResultado] = useState<ResultadoImport | null>(null)
  const [procesando, setProcesando] = useState(false)

  const procesarArchivo = useCallback((file: File) => {
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`El archivo supera los ${MAX_SIZE_MB}MB permitidos`)
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const wb = XLSX.read(data, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)

        if (jsonData.length === 0) {
          toast.error('El archivo no tiene datos')
          return
        }

        const filasRaw = parsearFilas(jsonData)
        const filasValidadas = filasRaw.map(validarFila)
        setFilas(filasValidadas)
        setStep(2)
      } catch {
        toast.error('No se pudo leer el archivo. Verifica que sea un Excel o CSV válido.')
      }
    }
    reader.readAsBinaryString(file)
  }, [])

  function handleFileDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) procesarArchivo(file)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) procesarArchivo(file)
  }

  const filasValidas = filas.filter((f) => f.valida)
  const filasConError = filas.filter((f) => !f.valida)

  async function importar() {
    if (!user || filasValidas.length === 0) return
    setProcesando(true)
    setStep(3)
    setProgreso(0)

    const resultado: ResultadoImport = {
      creados: 0,
      actualizados: 0,
      errores: 0,
      detalles: [],
    }

    // Obtener todos los códigos existentes en un solo query
    const codigos = filasValidas.map((f) => f.datos.codigo_interno)
    const { data: existentes } = await supabase
      .from('productos')
      .select('id, codigo_interno')
      .eq('sucursal_id', user.sucursal_id)
      .in('codigo_interno', codigos)

    const mapaExistentes = new Map<string, string>(
      (existentes ?? []).map((p) => [p.codigo_interno, p.id]),
    )

    for (let i = 0; i < filasValidas.length; i++) {
      const fila = filasValidas[i]
      const datos = fila.datos

      const payload: Database['public']['Tables']['productos']['Insert'] = {
        sucursal_id: user.sucursal_id,
        codigo_interno: datos.codigo_interno,
        nombre: datos.nombre,
        precio_venta:
          typeof datos.precio_venta === 'string'
            ? parseFloat(datos.precio_venta) || 0
            : Number(datos.precio_venta),
        costo:
          typeof datos.costo === 'string'
            ? parseFloat(datos.costo as string) || 0
            : Number(datos.costo ?? 0),
        stock_actual: Number(datos.stock_inicial ?? 0),
        stock_minimo: Number(datos.stock_minimo ?? 0),
        codigo_barras: datos.codigo_barras ?? null,
        marca: datos.marca ?? null,
        viscosidad_especificacion: datos.viscosidad_especificacion ?? null,
        tiene_codigo_barras: false,
        foto_url: null,
        activo: true,
        categoria_id: null,
        ubicacion_id: null,
      }

      const existenteId = mapaExistentes.get(datos.codigo_interno)

      if (existenteId) {
        const { error } = await supabase
          .from('productos')
          .update({
            nombre: payload.nombre,
            precio_venta: payload.precio_venta,
            costo: payload.costo,
            stock_minimo: payload.stock_minimo,
            codigo_barras: payload.codigo_barras,
            marca: payload.marca,
            viscosidad_especificacion: payload.viscosidad_especificacion,
          })
          .eq('id', existenteId)
          .eq('sucursal_id', user.sucursal_id)

        if (error) {
          resultado.errores++
          resultado.detalles.push(`Fila ${fila.rowNum}: ${error.message}`)
        } else {
          resultado.actualizados++
        }
      } else {
        const { data: prod, error } = await supabase
          .from('productos')
          .insert(payload)
          .select('id')
          .single()

        if (error) {
          resultado.errores++
          resultado.detalles.push(`Fila ${fila.rowNum}: ${error.message}`)
        } else {
          resultado.creados++
          // Registrar stock inicial si > 0
          if (Number(datos.stock_inicial ?? 0) > 0 && prod) {
            await supabase.rpc('registrar_movimiento_stock', {
              p_producto_id: prod.id,
              p_tipo: 'entrada',
              p_cantidad: Number(datos.stock_inicial),
              p_motivo: 'Stock inicial importado',
            })
          }
        }
      }

      setProgreso(Math.round(((i + 1) / filasValidas.length) * 100))
    }

    setResultado(resultado)
    setProcesando(false)
  }

  function reiniciar() {
    setStep(1)
    setFilas([])
    setProgreso(0)
    setResultado(null)
    setProcesando(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Importación de Productos
      </h1>

      {/* Stepper */}
      <div className="flex items-center gap-0 mb-8">
        {([
          [1, 'Seleccionar Archivo'],
          [2, 'Vista Previa'],
          [3, 'Resultado'],
        ] as const).map(([num, label], idx) => (
          <div key={num} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors',
                  step === num
                    ? 'bg-primary-700 border-primary-700 text-white'
                    : step > num
                    ? 'bg-primary-100 border-primary-300 text-primary-700'
                    : 'bg-white border-gray-300 text-gray-400',
                )}
              >
                {step > num ? '✓' : num}
              </div>
              <span
                className={cn(
                  'text-xs mt-1 font-medium text-center',
                  step === num ? 'text-primary-700' : 'text-gray-400',
                )}
              >
                {label}
              </span>
            </div>
            {idx < 2 && (
              <div
                className={cn(
                  'flex-1 h-0.5 mb-5',
                  step > num ? 'bg-primary-300' : 'bg-gray-200',
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* PASO 1: Seleccionar archivo */}
      {step === 1 && (
        <div className="space-y-6">
          {/* Zona drag-and-drop */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors',
              dragging
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50',
            )}
          >
            <div className="text-5xl mb-4">📂</div>
            <p className="text-lg font-medium text-gray-700">
              Arrastra tu archivo aquí
            </p>
            <p className="text-sm text-gray-400 mt-1">
              o haz clic para seleccionarlo
            </p>
            <p className="text-xs text-gray-400 mt-3">
              Formatos: .xlsx, .xls, .csv · Máx. {MAX_SIZE_MB}MB
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileInput}
              className="hidden"
            />
          </div>

          {/* Botón de plantilla */}
          <div className="card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-gray-800 mb-1">
                  Descarga la Plantilla
                </h3>
                <ul className="text-sm text-gray-500 space-y-1">
                  <li>• Columnas requeridas: <strong>codigo_interno</strong>, <strong>nombre</strong>, <strong>precio_venta</strong></li>
                  <li>• Columnas opcionales: codigo_barras, marca, viscosidad_especificacion, stock_minimo, stock_inicial, costo</li>
                  <li>• Si el código ya existe, se actualizarán los datos del producto</li>
                  <li>• El stock_inicial solo aplica al crear productos nuevos</li>
                </ul>
              </div>
              <button
                onClick={descargarPlantilla}
                className="btn-secondary shrink-0"
              >
                Descargar Plantilla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PASO 2: Vista previa y validación */}
      {step === 2 && (
        <div>
          {/* Resumen */}
          <div className="flex gap-4 mb-4">
            <div className="card flex-1 text-center py-4">
              <p className="text-3xl font-bold text-green-600">
                {filasValidas.length}
              </p>
              <p className="text-sm text-gray-500 mt-1">Filas válidas</p>
            </div>
            <div className="card flex-1 text-center py-4">
              <p className="text-3xl font-bold text-red-600">
                {filasConError.length}
              </p>
              <p className="text-sm text-gray-500 mt-1">Con errores</p>
            </div>
            <div className="card flex-1 text-center py-4">
              <p className="text-3xl font-bold text-gray-900">{filas.length}</p>
              <p className="text-sm text-gray-500 mt-1">Total filas</p>
            </div>
          </div>

          {/* Tabla de vista previa */}
          <div className="card p-0 overflow-hidden mb-4">
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                  <tr className="text-left text-gray-600">
                    <th className="px-3 py-2 font-medium">Fila</th>
                    <th className="px-3 py-2 font-medium">Estado</th>
                    <th className="px-3 py-2 font-medium">Código</th>
                    <th className="px-3 py-2 font-medium">Nombre</th>
                    <th className="px-3 py-2 font-medium">Precio</th>
                    <th className="px-3 py-2 font-medium">Marca</th>
                    <th className="px-3 py-2 font-medium">Errores</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filas.map((f) => (
                    <tr
                      key={f.rowNum}
                      className={cn(
                        'hover:bg-gray-50',
                        !f.valida && 'bg-red-50',
                      )}
                    >
                      <td className="px-3 py-2 text-gray-400">{f.rowNum}</td>
                      <td className="px-3 py-2">
                        {f.valida ? (
                          <span className="text-green-600 font-bold">✓</span>
                        ) : (
                          <span className="text-red-600 font-bold">✗</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {f.datos.codigo_interno || '—'}
                      </td>
                      <td className="px-3 py-2 max-w-[200px] truncate">
                        {f.datos.nombre || '—'}
                      </td>
                      <td className="px-3 py-2">
                        {f.datos.precio_venta !== '' ? String(f.datos.precio_venta) : '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-500">
                        {f.datos.marca ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-red-600 text-xs">
                        {f.errores.join(', ') || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button onClick={reiniciar} className="btn-secondary">
              Cancelar
            </button>
            <button
              onClick={importar}
              disabled={filasValidas.length === 0}
              className="btn-primary"
            >
              Importar {filasValidas.length} fila
              {filasValidas.length !== 1 ? 's' : ''} válida
              {filasValidas.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}

      {/* PASO 3: Progreso y resultado */}
      {step === 3 && (
        <div className="space-y-6">
          {procesando && (
            <div className="card">
              <h2 className="font-semibold text-gray-800 mb-4">
                Importando productos...
              </h2>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-primary-700 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${progreso}%` }}
                />
              </div>
              <p className="text-sm text-gray-500 mt-3 text-center">
                {progreso}% completado
              </p>
            </div>
          )}

          {resultado && !procesando && (
            <div>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="card text-center py-5">
                  <p className="text-4xl font-bold text-green-600">
                    {resultado.creados}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">Creados</p>
                </div>
                <div className="card text-center py-5">
                  <p className="text-4xl font-bold text-blue-600">
                    {resultado.actualizados}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">Actualizados</p>
                </div>
                <div className="card text-center py-5">
                  <p className="text-4xl font-bold text-red-600">
                    {resultado.errores}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">Errores</p>
                </div>
              </div>

              {resultado.detalles.length > 0 && (
                <div className="card bg-red-50 border border-red-200 mb-6">
                  <h3 className="font-semibold text-red-700 mb-2">
                    Detalles de errores:
                  </h3>
                  <ul className="text-sm text-red-600 space-y-1">
                    {resultado.detalles.map((d, i) => (
                      <li key={i}>• {d}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={reiniciar} className="btn-secondary flex-1">
                  Nueva Importación
                </button>
                <Link to="/productos" className="btn-primary flex-1 text-center">
                  Ver Productos
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
