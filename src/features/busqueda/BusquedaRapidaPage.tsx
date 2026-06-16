import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import { formatCurrency } from '@/shared/utils/formatters'
import type { Database } from '@/shared/types/database'
import jsQR from 'jsqr'

type ProductoDetalle = Database['public']['Views']['vw_productos_detalle']['Row']

type BusquedaEstado = 'idle' | 'buscando' | 'encontrado_uno' | 'encontrado_varios' | 'sin_resultados'

export function BusquedaRapidaPage() {
  const { user } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const qrIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastKeypressRef = useRef<number>(0)
  const barcodeBufferRef = useRef<string>('')

  const [query, setQuery] = useState('')
  const [estado, setEstado] = useState<BusquedaEstado>('idle')
  const [resultados, setResultados] = useState<ProductoDetalle[]>([])
  const [seleccionado, setSeleccionado] = useState<ProductoDetalle | null>(null)
  const [camaraActiva, setCamaraActiva] = useState(false)
  const [camaraError, setCamaraError] = useState('')

  // Autofocus
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Cerrar cámara al desmontar
  useEffect(() => {
    return () => {
      detenerCamara()
    }
  }, [])

  function detenerCamara() {
    if (qrIntervalRef.current) clearInterval(qrIntervalRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCamaraActiva(false)
  }

  async function iniciarCamara() {
    setCamaraError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream
      setCamaraActiva(true)
      // Esperar a que el DOM se actualice
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
          qrIntervalRef.current = setInterval(escanearFrame, 250)
        }
      }, 100)
    } catch {
      setCamaraError('No se pudo acceder a la cámara. Verifica los permisos.')
    }
  }

  function escanearFrame() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const code = jsQR(imageData.data, imageData.width, imageData.height)

    if (code) {
      const decoded = code.data
      // Extraer codigo_interno de la URL si está embebido
      let termino = decoded
      try {
        const url = new URL(decoded)
        const params = new URLSearchParams(url.search)
        termino =
          params.get('codigo_interno') ??
          params.get('codigo') ??
          url.pathname.split('/').pop() ??
          decoded
      } catch {
        // No es URL, usar directamente
      }
      detenerCamara()
      setQuery(termino)
      ejecutarBusqueda(termino)
    }
  }

  const ejecutarBusqueda = useCallback(
    async (termino: string) => {
      if (!termino.trim() || !user) return
      setEstado('buscando')
      setResultados([])
      setSeleccionado(null)

      try {
        let resultados: ProductoDetalle[] = []

        // Primero buscar por código de barras (si es numérico >= 8 dígitos)
        if (/^\d{8,}$/.test(termino)) {
          const { data } = await supabase
            .from('vw_productos_detalle')
            .select('*')
            .eq('sucursal_id', user.sucursal_id)
            .eq('activo', true)
            .eq('codigo_barras', termino)
          resultados = data ?? []
        }

        // Si no encontró por barras, buscar por codigo_interno exacto
        if (resultados.length === 0) {
          const { data } = await supabase
            .from('vw_productos_detalle')
            .select('*')
            .eq('sucursal_id', user.sucursal_id)
            .eq('activo', true)
            .eq('codigo_interno', termino)
          resultados = data ?? []
        }

        // Si no encontró exacto, buscar por nombre/código/marca (ilike)
        if (resultados.length === 0) {
          const { data } = await supabase
            .from('vw_productos_detalle')
            .select('*')
            .eq('sucursal_id', user.sucursal_id)
            .eq('activo', true)
            .or(
              `nombre.ilike.%${termino}%,codigo_interno.ilike.%${termino}%,marca.ilike.%${termino}%`,
            )
            .order('nombre')
            .limit(20)
          resultados = data ?? []
        }

        if (resultados.length === 0) {
          setEstado('sin_resultados')
        } else if (resultados.length === 1) {
          setSeleccionado(resultados[0])
          setEstado('encontrado_uno')
        } else {
          setResultados(resultados)
          setEstado('encontrado_varios')
        }
      } catch {
        setEstado('sin_resultados')
      }
    },
    [user],
  )

  // Detección de escáner USB (keystrokes rápidos)
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const now = Date.now()
    const delta = now - lastKeypressRef.current
    lastKeypressRef.current = now

    if (e.key === 'Enter') {
      ejecutarBusqueda(query)
      return
    }

    // Si los keystrokes llegan en < 50ms → es escáner
    if (delta < 50 && e.key.length === 1) {
      barcodeBufferRef.current += e.key
    } else if (delta >= 50) {
      barcodeBufferRef.current = e.key.length === 1 ? e.key : ''
    }
  }

  // También disparar búsqueda si el buffer del escáner se completa con Enter
  function handleKeyUp(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && barcodeBufferRef.current.length >= 8) {
      const codigo = barcodeBufferRef.current
      barcodeBufferRef.current = ''
      setQuery(codigo)
      ejecutarBusqueda(codigo)
    }
  }

  function resetear() {
    setQuery('')
    setEstado('idle')
    setResultados([])
    setSeleccionado(null)
    detenerCamara()
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function stockBadgeClass(estado: string) {
    if (estado === 'agotado') return 'badge-agotado'
    if (estado === 'bajo') return 'badge-bajo'
    return 'badge-ok'
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">
        Búsqueda Rápida
      </h1>

      {/* Input principal */}
      {(estado === 'idle' || estado === 'buscando' || estado === 'sin_resultados') && (
        <div className="mb-6">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onKeyUp={handleKeyUp}
              placeholder="Nombre, código o escanear código de barras..."
              className="input-field text-lg py-4 pr-14 w-full"
              autoComplete="off"
              autoFocus
            />
            <button
              onClick={() => ejecutarBusqueda(query)}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-primary-700 text-white rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-primary-800 transition-colors"
            >
              Buscar
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">
            Escribe o escanea con lector de código de barras. Presiona Enter para buscar.
          </p>
        </div>
      )}

      {/* Spinner de búsqueda */}
      {estado === 'buscando' && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-12 h-12 border-4 border-primary-700 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500">Buscando...</p>
        </div>
      )}

      {/* Sin resultados */}
      {estado === 'sin_resultados' && (
        <div className="card text-center py-12">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-gray-700 font-medium">
            No se encontró ningún producto
          </p>
          <p className="text-gray-400 text-sm mt-1">
            para "{query}"
          </p>
          <button onClick={resetear} className="btn-secondary mt-5">
            Nueva búsqueda
          </button>
        </div>
      )}

      {/* Resultado único - tarjeta grande */}
      {(estado === 'encontrado_uno' || (estado === 'encontrado_varios' && seleccionado)) && seleccionado && (
        <div>
          <div className="card mb-4">
            {seleccionado.foto_url && (
              <img
                src={seleccionado.foto_url}
                alt={seleccionado.nombre}
                className="w-full h-48 object-cover rounded-xl mb-4"
              />
            )}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900">
                  {seleccionado.nombre}
                </h2>
                {seleccionado.marca && (
                  <p className="text-gray-500 mt-0.5">{seleccionado.marca}</p>
                )}
                {seleccionado.viscosidad_especificacion && (
                  <p className="text-sm text-gray-400 mt-0.5">
                    {seleccionado.viscosidad_especificacion}
                  </p>
                )}
                <p className="font-mono text-xs text-gray-400 mt-2">
                  {seleccionado.codigo_interno}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-3xl font-bold text-primary-700">
                  {formatCurrency(seleccionado.precio_venta)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-100">
              <div>
                <p className="text-xs text-gray-500">Stock</p>
                <div className="mt-1">
                  <span className={stockBadgeClass(seleccionado.stock_estado)}>
                    {seleccionado.stock_estado === 'ok'
                      ? 'OK'
                      : seleccionado.stock_estado === 'bajo'
                      ? 'Bajo'
                      : 'Agotado'}
                  </span>
                  <p className="text-sm font-semibold text-gray-900 mt-1">
                    {seleccionado.stock_actual} uds.
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500">Categoría</p>
                <p className="text-sm font-medium text-gray-900 mt-1">
                  {seleccionado.categoria_nombre ?? '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Ubicación</p>
                {seleccionado.ubicacion_codigo ? (
                  <span className="inline-block font-mono text-xs bg-blue-50 text-primary-700 px-2 py-0.5 rounded mt-1">
                    {seleccionado.ubicacion_codigo}
                  </span>
                ) : (
                  <p className="text-sm text-gray-400 mt-1">—</p>
                )}
              </div>
            </div>
          </div>

          <button onClick={resetear} className="btn-secondary w-full">
            Nueva búsqueda
          </button>
        </div>
      )}

      {/* Múltiples resultados */}
      {estado === 'encontrado_varios' && !seleccionado && (
        <div>
          <p className="text-sm text-gray-500 mb-3">
            {resultados.length} productos encontrados. Selecciona uno:
          </p>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {resultados.map((p) => (
              <button
                key={p.id}
                onClick={() => setSeleccionado(p)}
                className="w-full text-left card hover:border-primary-200 border border-transparent transition-colors p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                      {p.nombre}
                    </div>
                    <div className="text-xs text-gray-400 font-mono mt-0.5">
                      {p.codigo_interno}
                      {p.marca ? ` • ${p.marca}` : ''}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-bold text-primary-700">
                      {formatCurrency(p.precio_venta)}
                    </div>
                    <div className="mt-1">
                      <span className={stockBadgeClass(p.stock_estado)}>
                        {p.stock_actual} uds.
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <button onClick={resetear} className="btn-secondary w-full mt-4">
            Nueva búsqueda
          </button>
        </div>
      )}

      {/* Botón de cámara QR */}
      {(estado === 'idle' || estado === 'sin_resultados') && !camaraActiva && (
        <div className="mt-6 text-center">
          <button
            onClick={iniciarCamara}
            className="btn-secondary"
          >
            Buscar con cámara QR
          </button>
          {camaraError && (
            <p className="error-text mt-2">{camaraError}</p>
          )}
        </div>
      )}

      {/* Vista de cámara */}
      {camaraActiva && (
        <div className="mt-6">
          <div className="relative rounded-2xl overflow-hidden bg-black">
            <video
              ref={videoRef}
              className="w-full"
              playsInline
              muted
            />
            {/* Marco de escaneo */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-56 h-56 border-4 border-primary-400 rounded-2xl opacity-70" />
            </div>
          </div>
          <canvas ref={canvasRef} className="hidden" />
          <p className="text-sm text-gray-500 text-center mt-3">
            Apunta la cámara al código QR del producto
          </p>
          <button
            onClick={detenerCamara}
            className="btn-secondary w-full mt-3"
          >
            Cerrar cámara
          </button>
        </div>
      )}
    </div>
  )
}
