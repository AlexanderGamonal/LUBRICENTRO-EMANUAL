import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import { toast } from 'sonner'
import type { Database } from '@/shared/types/database'

type ProductoDetalle = Database['public']['Views']['vw_productos_detalle']['Row']

interface ProductoFilters {
  search?: string
  categoria_id?: string
  soloActivos?: boolean
}

export function useProductos(filters: ProductoFilters = {}) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['productos', user?.sucursal_id, filters],
    queryFn: async () => {
      let q = supabase
        .from('vw_productos_detalle')
        .select('*')
        .eq('sucursal_id', user!.sucursal_id)
        .order('nombre')

      if (filters.soloActivos !== false) q = q.eq('activo', true)
      if (filters.categoria_id) q = q.eq('categoria_id', filters.categoria_id)
      if (filters.search) {
        q = q.or(
          `nombre.ilike.%${filters.search}%,codigo_interno.ilike.%${filters.search}%,marca.ilike.%${filters.search}%`,
        )
      }

      const { data, error } = await q
      if (error) throw error
      return data as ProductoDetalle[]
    },
    enabled: !!user,
  })
}

export function useProducto(id: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['producto', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vw_productos_detalle')
        .select('*')
        .eq('id', id)
        .eq('sucursal_id', user!.sucursal_id)
        .single()
      if (error) throw error
      return data as ProductoDetalle
    },
    enabled: !!user && !!id,
  })
}

type ProductoInsert = Database['public']['Tables']['productos']['Insert']
type ProductoUpdate = Database['public']['Tables']['productos']['Update']

export function useProductoMutations() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const invalidate = () => qc.invalidateQueries({ queryKey: ['productos'] })

  const crearProducto = useMutation({
    mutationFn: async (data: ProductoInsert) => {
      const { data: prod, error } = await supabase
        .from('productos')
        .insert(data)
        .select()
        .single()
      if (error) throw error
      return prod
    },
    onSuccess: () => {
      toast.success('Producto creado')
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const actualizarProducto = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & ProductoUpdate) => {
      const { error } = await supabase
        .from('productos')
        .update(data)
        .eq('id', id)
        .eq('sucursal_id', user!.sucursal_id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Producto actualizado')
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const desactivarProducto = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('productos')
        .update({ activo: false })
        .eq('id', id)
        .eq('sucursal_id', user!.sucursal_id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Producto desactivado')
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return { crearProducto, actualizarProducto, desactivarProducto }
}
