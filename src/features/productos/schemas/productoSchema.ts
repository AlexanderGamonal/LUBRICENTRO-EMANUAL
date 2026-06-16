import { z } from 'zod'

export const productoSchema = z.object({
  codigo_interno: z.string().min(1, 'El código interno es obligatorio'),
  codigo_barras: z.string().optional().or(z.literal('')),
  nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  marca: z.string().optional().or(z.literal('')),
  viscosidad_especificacion: z.string().optional().or(z.literal('')),
  categoria_id: z.string().uuid().optional().or(z.literal('')),
  ubicacion_id: z.string().uuid().optional().or(z.literal('')),
  precio_venta: z.number({ invalid_type_error: 'Ingresa un precio válido' }).min(0, 'El precio no puede ser negativo'),
  costo: z.number().min(0).optional().default(0),
  stock_minimo: z.number().int().min(0).optional().default(0),
  stock_inicial: z.number().int().min(0).optional().default(0),
  tiene_codigo_barras: z.boolean().optional().default(false),
  activo: z.boolean().optional().default(true),
})

export type ProductoFormData = z.infer<typeof productoSchema>
