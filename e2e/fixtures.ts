/** Datos de ejemplo para la auditoría visual (no son datos reales). */
const SUC = 'suc-1'
const now = '2026-10-02T15:30:00.123456+00:00'
const today = '2026-10-02'

const productos = [
  { n: 'Aceite Mobil 1 5W-30 Sintético 1L', c: 'LUB-001', m: 'Mobil', cat: 'Lubricantes', u: 'A-1-1', pv: 68.5, co: 49, s: 24, min: 10 },
  { n: 'Filtro de aceite Toyota Hilux 2.8', c: 'FIL-014', m: 'Toyota', cat: 'Filtros', u: 'B-2-3', pv: 42, co: 28.5, s: 3, min: 6 },
  { n: 'Refrigerante concentrado rojo 4L', c: 'REF-003', m: 'Prestone', cat: 'Refrigerantes', u: 'C-1-2', pv: 55, co: 0, s: 0, min: 4 },
  { n: 'Aceite Castrol GTX 20W-50 Galón', c: 'LUB-022', m: 'Castrol', cat: 'Lubricantes', u: null, pv: 89.9, co: 71, s: 12, min: 5 },
].map((p, i) => ({
  id: `prod-${i + 1}`,
  sucursal_id: SUC,
  codigo_interno: p.c,
  codigo_barras: null,
  nombre: p.n,
  marca: p.m,
  viscosidad_especificacion: null,
  precio_venta: p.pv,
  costo: p.co,
  stock_actual: p.s,
  stock_minimo: p.min,
  tiene_codigo_barras: false,
  foto_url: null,
  activo: true,
  created_at: now,
  updated_at: now,
  categoria_id: `cat-${i}`,
  categoria_nombre: p.cat,
  ubicacion_id: p.u ? `ub-${i}` : null,
  zona: null,
  estante: null,
  nivel: null,
  ubicacion_codigo: p.u,
  stock_estado: p.s === 0 ? 'agotado' : p.s <= p.min ? 'bajo' : 'ok',
  valor_costo_total: p.co * p.s,
  valor_venta_total: p.pv * p.s,
}))

const clientes = [
  { n: 'Transportes Andinos S.A.C.', t: 'empresa', tel: '987654321', r: '20601234567' },
  { n: 'Luis Fernando Huamán Quispe', t: 'persona', tel: '956123456', r: '45123987' },
  { n: 'María del Carmen Flores', t: 'persona', tel: null, r: null },
].map((c, i) => ({
  id: `cli-${i + 1}`,
  sucursal_id: SUC,
  nombre: c.n,
  telefono: c.tel,
  email: i === 0 ? 'compras@andinos.pe' : null,
  tipo: c.t,
  ruc_dni: c.r,
  direccion: null,
  activo: true,
  created_at: now,
  updated_at: now,
}))

const vehiculos = [
  { p: 'ABC-123', m: 'Toyota', mo: 'Hilux', a: 2019, c: 'Blanco', cl: 0 },
  { p: 'XYZ-987', m: 'Hyundai', mo: 'Accent', a: 2016, c: 'Gris', cl: 1 },
  { p: 'D4F-556', m: 'Honda', mo: 'CB 190R', a: 2021, c: null, cl: 2 },
].map((v, i) => ({
  id: `veh-${i + 1}`,
  placa: v.p,
  marca_vehiculo: v.m,
  modelo: v.mo,
  anio: v.a,
  color: v.c,
  activo: true,
  updated_at: now,
  clientes: { id: clientes[v.cl].id, nombre: clientes[v.cl].nombre, telefono: clientes[v.cl].telefono },
}))

const servicios = [
  { d: 'Cambio de aceite y filtro', t: 168.5, e: 'terminado', v: 0 },
  { d: 'Revisión de frenos y cambio de pastillas delanteras', t: 320, e: 'pendiente', v: 1 },
  { d: 'Cambio de aceite 20W-50', t: 45, e: 'terminado', v: 2 },
].map((s, i) => ({
  id: `serv-${i + 1}`,
  sucursal_id: SUC,
  vehiculo_id: vehiculos[s.v].id,
  cliente_id: vehiculos[s.v].clientes.id,
  usuario_id: 'usr-1',
  kilometraje: 45200 + i * 1300,
  descripcion: s.d,
  observaciones: null,
  estado: s.e,
  fecha_servicio: today,
  total: s.t,
  monto_servicio: 30,
  created_at: now,
  updated_at: now,
  vehiculos: { placa: vehiculos[s.v].placa, marca_vehiculo: vehiculos[s.v].marca_vehiculo, modelo: vehiculos[s.v].modelo },
  clientes: { nombre: vehiculos[s.v].clientes.nombre, telefono: vehiculos[s.v].clientes.telefono },
}))

const creditos = [
  { c: 0, mt: 450, mp: 150, e: 'parcial', venc: '2026-10-20' },
  { c: 1, mt: 120, mp: 0, e: 'pendiente', venc: null },
  { c: 2, mt: 78.5, mp: 0, e: 'vencido', venc: '2026-09-15' },
].map((c, i) => ({
  id: `cred-${i + 1}`,
  sucursal_id: SUC,
  cliente_id: clientes[c.c].id,
  venta_id: `v-${i + 1}`,
  monto_total: c.mt,
  monto_pagado: c.mp,
  saldo: c.mt - c.mp,
  estado: c.e,
  fecha_vencimiento: c.venc,
  created_at: now,
  updated_at: now,
  clientes: { nombre: clientes[c.c].nombre, telefono: clientes[c.c].telefono },
}))

const ventas = [
  { cl: 'Transportes Andinos S.A.C.', t: 310.5, mp: 'credito', it: 4, e: 'emitida' },
  { cl: null, t: 68.5, mp: 'efectivo', it: 1, e: 'emitida' },
  { cl: 'Luis Fernando Huamán Quispe', t: 97, mp: 'yape', it: 2, e: 'anulada' },
].map((v, i) => ({
  id: `v-${i + 1}`,
  sucursal_id: SUC,
  subtotal: v.t,
  descuento: 0,
  total: v.t,
  medio_pago: v.mp,
  estado: v.e,
  observaciones: null,
  created_at: now,
  updated_at: now,
  cliente_id: null,
  cliente_nombre: v.cl,
  cliente_telefono: null,
  usuario_id: 'usr-1',
  usuario_nombre: 'Manuel Quispe',
  total_items: v.it,
}))

const gananciasVentas = [{ sucursal_id: SUC, fecha: today, ingresos: 476, costo_real: 331.5, ganancia: 144.5, total_ventas: 3 }]
const gananciasServicios = [{ sucursal_id: SUC, fecha: today, ingresos: 533.5, costo_real: 180, ganancia: 353.5, total_servicios: 3, total_mano_obra: 90 }]

/** Tablas/vistas que el mock de Supabase responde con datos. */
export const FIXTURES: Record<string, unknown[]> = {
  vw_productos_detalle: productos,
  vw_stock_bajo: productos
    .filter((p) => p.stock_estado !== 'ok')
    .map((p) => ({ ...p, deficit: p.stock_minimo - p.stock_actual })),
  vw_valor_inventario: [{ sucursal_id: SUC, categoria: 'Lubricantes', total_productos: 38, total_unidades: 412, valor_costo: 9800, valor_venta: 14250 }],
  categorias: [{ id: 'cat-0', nombre: 'Lubricantes' }, { id: 'cat-1', nombre: 'Filtros' }],
  clientes,
  vehiculos,
  servicios,
  creditos_cliente: creditos,
  vw_ventas_detalle: ventas,
  vw_ganancias_ventas: gananciasVentas,
  vw_ganancias_servicios: gananciasServicios,
}
