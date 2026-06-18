export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type RolUsuario = 'superadmin' | 'admin' | 'vendedor' | 'almacen'
export type TipoMovimientoStock = 'entrada' | 'salida' | 'ajuste' | 'perdida' | 'devolucion' | 'venta' | 'servicio'
export type TipoCliente = 'natural' | 'empresa'
export type EstadoServicio = 'pendiente' | 'terminado' | 'anulado'
export type EstadoVenta = 'emitida' | 'anulada'
export type MedioPago = 'efectivo' | 'yape' | 'plin' | 'tarjeta' | 'transferencia' | 'credito' | 'mixto'
export type EstadoCaja = 'abierta' | 'cerrada'
export type TipoCajaMovimiento = 'ingreso' | 'egreso'
export type EstadoCredito = 'pendiente' | 'parcial' | 'pagado' | 'vencido'

export type ProductoInsert = {
  sucursal_id: string
  codigo_interno: string
  nombre: string
  precio_venta: number
  categoria_id?: string | null
  ubicacion_id?: string | null
  codigo_barras?: string | null
  marca?: string | null
  viscosidad_especificacion?: string | null
  costo?: number
  stock_actual?: number
  stock_minimo?: number
  tiene_codigo_barras?: boolean
  foto_url?: string | null
  activo?: boolean
}

export type ProductoUpdate = Partial<ProductoInsert>

export interface Database {
  public: {
    Tables: {
      sucursales: {
        Row: {
          id: string
          nombre: string
          direccion: string | null
          telefono: string | null
          activa: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          nombre: string
          direccion?: string | null
          telefono?: string | null
          activa?: boolean
        }
        Update: {
          nombre?: string
          direccion?: string | null
          telefono?: string | null
          activa?: boolean
        }
        Relationships: []
      }
      usuarios: {
        Row: {
          id: string
          auth_user_id: string | null
          sucursal_id: string
          nombre: string
          email: string | null
          rol: RolUsuario
          activo: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          sucursal_id: string
          nombre: string
          email?: string | null
          rol: RolUsuario
          activo?: boolean
        }
        Update: {
          auth_user_id?: string | null
          sucursal_id?: string
          nombre?: string
          email?: string | null
          rol?: RolUsuario
          activo?: boolean
        }
        Relationships: []
      }
      categorias: {
        Row: {
          id: string
          sucursal_id: string
          nombre: string
          descripcion: string | null
          activa: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          sucursal_id: string
          nombre: string
          descripcion?: string | null
          activa?: boolean
        }
        Update: {
          sucursal_id?: string
          nombre?: string
          descripcion?: string | null
          activa?: boolean
        }
        Relationships: []
      }
      ubicaciones: {
        Row: {
          id: string
          sucursal_id: string
          zona: string
          estante: number
          nivel: number
          codigo: string
          descripcion: string | null
          activa: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          sucursal_id: string
          zona: string
          estante: number
          nivel: number
          descripcion?: string | null
          activa?: boolean
        }
        Update: {
          descripcion?: string | null
          activa?: boolean
        }
        Relationships: []
      }
      productos: {
        Row: {
          id: string
          sucursal_id: string
          categoria_id: string | null
          ubicacion_id: string | null
          codigo_interno: string
          codigo_barras: string | null
          nombre: string
          marca: string | null
          viscosidad_especificacion: string | null
          precio_venta: number
          costo: number
          stock_actual: number
          stock_minimo: number
          tiene_codigo_barras: boolean
          foto_url: string | null
          activo: boolean
          created_at: string
          updated_at: string
        }
        Insert: ProductoInsert
        Update: ProductoUpdate
        Relationships: []
      }
      movimientos_stock: {
        Row: {
          id: string
          sucursal_id: string
          producto_id: string
          usuario_id: string | null
          tipo: TipoMovimientoStock
          cantidad: number
          cantidad_anterior: number
          cantidad_nueva: number
          motivo: string | null
          referencia_tipo: string | null
          referencia_id: string | null
          created_at: string
        }
        Insert: {
          sucursal_id: string
          producto_id: string
          usuario_id?: string | null
          tipo: TipoMovimientoStock
          cantidad: number
          cantidad_anterior: number
          cantidad_nueva: number
          motivo?: string | null
          referencia_tipo?: string | null
          referencia_id?: string | null
        }
        Update: never
        Relationships: []
      }
      clientes: {
        Row: {
          id: string
          sucursal_id: string
          nombre: string
          telefono: string | null
          email: string | null
          tipo: TipoCliente
          ruc_dni: string | null
          direccion: string | null
          activo: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          sucursal_id: string
          nombre: string
          telefono?: string | null
          email?: string | null
          tipo?: TipoCliente
          ruc_dni?: string | null
          direccion?: string | null
          activo?: boolean
        }
        Update: {
          sucursal_id?: string
          nombre?: string
          telefono?: string | null
          email?: string | null
          tipo?: TipoCliente
          ruc_dni?: string | null
          direccion?: string | null
          activo?: boolean
        }
        Relationships: []
      }
      servicios: {
        Row: {
          id: string
          sucursal_id: string
          vehiculo_id: string | null
          cliente_id: string | null
          usuario_id: string
          kilometraje: number | null
          descripcion: string
          observaciones: string | null
          estado: EstadoServicio
          fecha_servicio: string
          total: number
          created_at: string
          updated_at: string
        }
        Insert: {
          sucursal_id: string
          vehiculo_id?: string | null
          cliente_id?: string | null
          usuario_id: string
          kilometraje?: number | null
          descripcion: string
          observaciones?: string | null
          estado?: EstadoServicio
          fecha_servicio?: string
          total?: number
        }
        Update: {
          vehiculo_id?: string | null
          cliente_id?: string | null
          kilometraje?: number | null
          descripcion?: string
          observaciones?: string | null
          estado?: EstadoServicio
          fecha_servicio?: string
          total?: number
        }
        Relationships: []
      }
      servicio_productos: {
        Row: {
          id: string
          sucursal_id: string
          servicio_id: string
          producto_id: string
          cantidad: number
          precio_unitario: number
          subtotal: number
          created_at: string
        }
        Insert: {
          sucursal_id: string
          servicio_id: string
          producto_id: string
          cantidad: number
          precio_unitario: number
          subtotal: number
        }
        Update: never
        Relationships: []
      }
      mantenimientos_recomendados: {
        Row: {
          id: string
          marca_vehiculo: string
          modelo: string | null
          tipo_servicio: string
          descripcion: string
          intervalo_km: number | null
          intervalo_dias: number | null
          created_at: string
        }
        Insert: {
          marca_vehiculo: string
          modelo?: string | null
          tipo_servicio: string
          descripcion: string
          intervalo_km?: number | null
          intervalo_dias?: number | null
        }
        Update: {
          marca_vehiculo?: string
          modelo?: string | null
          tipo_servicio?: string
          descripcion?: string
          intervalo_km?: number | null
          intervalo_dias?: number | null
        }
        Relationships: []
      }
      vehiculos: {
        Row: {
          id: string
          sucursal_id: string
          cliente_id: string | null
          placa: string
          marca_vehiculo: string | null
          modelo: string | null
          anio: number | null
          color: string | null
          activo: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          sucursal_id: string
          cliente_id?: string | null
          placa: string
          marca_vehiculo?: string | null
          modelo?: string | null
          anio?: number | null
          color?: string | null
          activo?: boolean
        }
        Update: {
          sucursal_id?: string
          cliente_id?: string | null
          placa?: string
          marca_vehiculo?: string | null
          modelo?: string | null
          anio?: number | null
          color?: string | null
          activo?: boolean
        }
        Relationships: []
      }
      cajas: {
        Row: {
          id: string
          sucursal_id: string
          usuario_id: string
          fecha: string
          monto_apertura: number
          monto_cierre_esperado: number | null
          monto_cierre_real: number | null
          diferencia: number | null
          estado: EstadoCaja
          observaciones: string | null
          opened_at: string
          closed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          sucursal_id: string
          usuario_id: string
          fecha: string
          monto_apertura: number
          monto_cierre_esperado?: number | null
          monto_cierre_real?: number | null
          diferencia?: number | null
          estado?: EstadoCaja
          observaciones?: string | null
          opened_at: string
          closed_at?: string | null
        }
        Update: {
          sucursal_id?: string
          usuario_id?: string
          fecha?: string
          monto_apertura?: number
          monto_cierre_esperado?: number | null
          monto_cierre_real?: number | null
          diferencia?: number | null
          estado?: EstadoCaja
          observaciones?: string | null
          opened_at?: string
          closed_at?: string | null
        }
        Relationships: []
      }
      ventas: {
        Row: {
          id: string
          sucursal_id: string
          usuario_id: string
          cliente_id: string | null
          caja_id: string | null
          subtotal: number
          descuento: number
          total: number
          medio_pago: MedioPago
          estado: EstadoVenta
          observaciones: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          sucursal_id: string
          usuario_id: string
          cliente_id?: string | null
          caja_id?: string | null
          subtotal: number
          descuento?: number
          total: number
          medio_pago: MedioPago
          estado?: EstadoVenta
          observaciones?: string | null
        }
        Update: {
          sucursal_id?: string
          usuario_id?: string
          cliente_id?: string | null
          caja_id?: string | null
          subtotal?: number
          descuento?: number
          total?: number
          medio_pago?: MedioPago
          estado?: EstadoVenta
          observaciones?: string | null
        }
        Relationships: []
      }
      venta_items: {
        Row: {
          id: string
          sucursal_id: string
          venta_id: string
          producto_id: string | null
          cantidad: number
          precio_unitario: number
          costo_unitario: number
          subtotal: number
          created_at: string
        }
        Insert: {
          sucursal_id: string
          venta_id: string
          producto_id?: string | null
          cantidad: number
          precio_unitario: number
          costo_unitario?: number
          subtotal: number
        }
        Update: never
        Relationships: []
      }
      creditos_cliente: {
        Row: {
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
        }
        Insert: {
          sucursal_id: string
          cliente_id: string
          venta_id?: string | null
          monto_total: number
          monto_pagado?: number
          saldo: number
          estado?: EstadoCredito
          fecha_vencimiento?: string | null
        }
        Update: {
          sucursal_id?: string
          cliente_id?: string
          venta_id?: string | null
          monto_total?: number
          monto_pagado?: number
          saldo?: number
          estado?: EstadoCredito
          fecha_vencimiento?: string | null
        }
        Relationships: []
      }
      auditoria_eventos: {
        Row: {
          id: string
          sucursal_id: string | null
          usuario_id: string | null
          entidad: string
          entidad_id: string | null
          accion: string
          datos_anteriores: Json | null
          datos_nuevos: Json | null
          ip_address: string | null
          created_at: string
        }
        Insert: {
          sucursal_id?: string | null
          usuario_id?: string | null
          entidad: string
          entidad_id?: string | null
          accion: string
          datos_anteriores?: Json | null
          datos_nuevos?: Json | null
          ip_address?: string | null
        }
        Update: never
        Relationships: []
      }
    }
    Views: {
      vw_productos_detalle: {
        Row: {
          id: string
          sucursal_id: string
          codigo_interno: string
          codigo_barras: string | null
          nombre: string
          marca: string | null
          viscosidad_especificacion: string | null
          precio_venta: number
          costo: number
          stock_actual: number
          stock_minimo: number
          tiene_codigo_barras: boolean
          foto_url: string | null
          activo: boolean
          created_at: string
          updated_at: string
          categoria_id: string | null
          categoria_nombre: string | null
          ubicacion_id: string | null
          zona: string | null
          estante: number | null
          nivel: number | null
          ubicacion_codigo: string | null
          stock_estado: 'ok' | 'bajo' | 'agotado'
          valor_costo_total: number
          valor_venta_total: number
        }
        Relationships: []
      }
      vw_stock_bajo: {
        Row: {
          id: string
          sucursal_id: string
          codigo_interno: string
          nombre: string
          marca: string | null
          categoria_nombre: string | null
          ubicacion_codigo: string | null
          stock_actual: number
          stock_minimo: number
          deficit: number
          stock_estado: string
          precio_venta: number
          costo: number
        }
        Relationships: []
      }
      vw_valor_inventario: {
        Row: {
          sucursal_id: string
          categoria: string
          total_productos: number
          total_unidades: number
          valor_costo: number
          valor_venta: number
        }
        Relationships: []
      }
      vw_movimientos_stock_detalle: {
        Row: {
          id: string
          sucursal_id: string
          tipo: TipoMovimientoStock
          cantidad: number
          cantidad_anterior: number
          cantidad_nueva: number
          motivo: string | null
          referencia_tipo: string | null
          referencia_id: string | null
          created_at: string
          producto_id: string
          codigo_interno: string
          producto_nombre: string
          producto_marca: string | null
          usuario_id: string | null
          usuario_nombre: string | null
        }
        Relationships: []
      }
      vw_ventas_detalle: {
        Row: {
          id: string
          sucursal_id: string
          subtotal: number
          descuento: number
          total: number
          medio_pago: MedioPago
          estado: EstadoVenta
          observaciones: string | null
          created_at: string
          updated_at: string
          cliente_id: string | null
          cliente_nombre: string | null
          cliente_telefono: string | null
          usuario_id: string
          usuario_nombre: string
          total_items: number
        }
        Relationships: []
      }
      vw_caja_resumen: {
        Row: {
          id: string
          sucursal_id: string
          fecha: string
          estado: EstadoCaja
          monto_apertura: number
          monto_cierre_esperado: number | null
          monto_cierre_real: number | null
          diferencia: number | null
          opened_at: string
          closed_at: string | null
          observaciones: string | null
          usuario_nombre: string
          total_ingresos: number
          total_egresos: number
          saldo_calculado: number
          num_ingresos: number
          num_egresos: number
        }
        Relationships: []
      }
      vw_ganancias_ventas: {
        Row: {
          sucursal_id: string
          fecha: string
          ingresos: number
          costo_real: number
          ganancia: number
          total_ventas: number
        }
        Relationships: []
      }
      vw_servicios_detalle: {
        Row: {
          id: string
          sucursal_id: string
          vehiculo_id: string | null
          cliente_id: string | null
          usuario_id: string
          kilometraje: number | null
          descripcion: string
          observaciones: string | null
          estado: EstadoServicio
          fecha_servicio: string
          total: number
          created_at: string
          updated_at: string
          placa: string | null
          marca_vehiculo: string | null
          modelo: string | null
          anio: number | null
          cliente_nombre: string | null
          cliente_telefono: string | null
          usuario_nombre: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      registrar_movimiento_stock: {
        Args: {
          p_producto_id: string
          p_tipo: TipoMovimientoStock
          p_cantidad: number
          p_motivo?: string | null
          p_referencia_tipo?: string | null
          p_referencia_id?: string | null
        }
        Returns: Json
      }
      ajustar_stock: {
        Args: {
          p_producto_id: string
          p_stock_nuevo: number
          p_motivo: string
        }
        Returns: Json
      }
      abrir_caja: {
        Args: { p_monto_apertura?: number }
        Returns: Json
      }
      cerrar_caja: {
        Args: {
          p_caja_id: string
          p_monto_real: number
          p_observaciones?: string | null
        }
        Returns: Json
      }
      crear_venta: {
        Args: {
          p_items: Json
          p_medio_pago: MedioPago
          p_cliente_id?: string | null
          p_descuento?: number
          p_observaciones?: string | null
        }
        Returns: Json
      }
      anular_venta: {
        Args: { p_venta_id: string; p_motivo: string }
        Returns: Json
      }
      registrar_servicio: {
        Args: {
          p_vehiculo_id: string
          p_descripcion: string
          p_items: Json
          p_kilometraje?: number | null
          p_observaciones?: string | null
          p_cliente_id?: string | null
        }
        Returns: Json
      }
      registrar_pago_credito: {
        Args: {
          p_credito_id: string
          p_monto: number
          p_medio_pago?: MedioPago
          p_referencia?: string | null
        }
        Returns: Json
      }
      current_usuario_id: { Args: Record<string, never>; Returns: string }
      current_sucursal_id: { Args: Record<string, never>; Returns: string }
      current_user_role: { Args: Record<string, never>; Returns: string }
    }
    Enums: {
      rol_usuario: RolUsuario
      tipo_movimiento_stock: TipoMovimientoStock
      tipo_cliente: TipoCliente
      estado_servicio: EstadoServicio
      estado_venta: EstadoVenta
      medio_pago: MedioPago
      estado_caja: EstadoCaja
      tipo_caja_movimiento: TipoCajaMovimiento
      estado_credito: EstadoCredito
    }
    CompositeTypes: Record<string, never>
  }
}
