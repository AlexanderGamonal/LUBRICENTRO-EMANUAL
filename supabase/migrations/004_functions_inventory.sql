-- 004_functions_inventory.sql
-- Funciones RPC para movimientos de inventario

-- ============================================================
-- RPC: registrar_movimiento_stock
-- Registra un movimiento de stock de forma atómica.
-- Valida stock suficiente, actualiza productos y guarda historial.
-- ============================================================
create or replace function registrar_movimiento_stock(
  p_producto_id    uuid,
  p_tipo           tipo_movimiento_stock,
  p_cantidad       integer,
  p_motivo         text default null,
  p_referencia_tipo text default null,
  p_referencia_id  uuid default null
)
returns movimientos_stock
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id    uuid;
  v_sucursal_id   uuid;
  v_stock_actual  integer;
  v_stock_nuevo   integer;
  v_delta         integer;
  v_movimiento    movimientos_stock;
begin
  -- Obtener contexto del usuario actual
  v_usuario_id  := current_usuario_id();
  v_sucursal_id := current_sucursal_id();

  if v_usuario_id is null then
    raise exception 'Usuario no autenticado o inactivo';
  end if;

  -- Bloquear fila del producto para evitar race conditions
  select stock_actual into v_stock_actual
  from productos
  where id = p_producto_id
    and sucursal_id = v_sucursal_id
    and activo = true
  for update;

  if not found then
    raise exception 'Producto no encontrado o no pertenece a esta sucursal';
  end if;

  -- Calcular delta según tipo
  case p_tipo
    when 'salida', 'perdida', 'venta', 'servicio' then
      v_delta := -abs(p_cantidad);
    when 'entrada', 'devolucion' then
      v_delta := abs(p_cantidad);
    when 'ajuste' then
      v_delta := p_cantidad; -- puede ser positivo o negativo
    else
      raise exception 'Tipo de movimiento no válido: %', p_tipo;
  end case;

  v_stock_nuevo := v_stock_actual + v_delta;

  if v_stock_nuevo < 0 then
    raise exception 'Stock insuficiente. Stock actual: %, cantidad solicitada: %',
      v_stock_actual, abs(v_delta);
  end if;

  -- Actualizar stock del producto
  update productos
  set stock_actual = v_stock_nuevo,
      updated_at   = now()
  where id = p_producto_id;

  -- Insertar movimiento
  insert into movimientos_stock (
    sucursal_id,
    producto_id,
    usuario_id,
    tipo,
    cantidad,
    cantidad_anterior,
    cantidad_nueva,
    motivo,
    referencia_tipo,
    referencia_id
  ) values (
    v_sucursal_id,
    p_producto_id,
    v_usuario_id,
    p_tipo,
    v_delta,
    v_stock_actual,
    v_stock_nuevo,
    p_motivo,
    p_referencia_tipo,
    p_referencia_id
  )
  returning * into v_movimiento;

  -- Registrar en auditoría
  insert into auditoria_eventos (
    sucursal_id, usuario_id, entidad, entidad_id,
    accion, datos_anteriores, datos_nuevos
  ) values (
    v_sucursal_id, v_usuario_id, 'productos', p_producto_id,
    'movimiento_stock',
    jsonb_build_object('stock_actual', v_stock_actual, 'tipo', p_tipo),
    jsonb_build_object('stock_nuevo', v_stock_nuevo, 'delta', v_delta, 'motivo', p_motivo)
  );

  return v_movimiento;
end;
$$;

-- ============================================================
-- RPC: ajustar_stock
-- Ajusta el stock de un producto a una cantidad específica.
-- Requiere motivo obligatorio.
-- ============================================================
create or replace function ajustar_stock(
  p_producto_id uuid,
  p_stock_nuevo  integer,
  p_motivo       text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sucursal_id  uuid;
  v_stock_actual integer;
  v_delta        integer;
  v_movimiento   movimientos_stock;
begin
  if p_motivo is null or trim(p_motivo) = '' then
    raise exception 'El motivo del ajuste es obligatorio';
  end if;

  if p_stock_nuevo < 0 then
    raise exception 'El stock nuevo no puede ser negativo';
  end if;

  v_sucursal_id := current_sucursal_id();

  if v_sucursal_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  -- Obtener stock actual con lock
  select stock_actual into v_stock_actual
  from productos
  where id = p_producto_id
    and sucursal_id = v_sucursal_id
    and activo = true
  for update;

  if not found then
    raise exception 'Producto no encontrado o no pertenece a esta sucursal';
  end if;

  v_delta := p_stock_nuevo - v_stock_actual;

  if v_delta = 0 then
    return jsonb_build_object(
      'mensaje', 'Sin cambios en stock',
      'stock_actual', v_stock_actual
    );
  end if;

  -- Registrar el ajuste como movimiento
  select * into v_movimiento
  from registrar_movimiento_stock(
    p_producto_id,
    'ajuste',
    v_delta,
    p_motivo,
    'ajuste_manual',
    null
  );

  return jsonb_build_object(
    'movimiento_id',   v_movimiento.id,
    'stock_anterior',  v_stock_actual,
    'stock_nuevo',     p_stock_nuevo,
    'delta',           v_delta,
    'motivo',          p_motivo
  );
end;
$$;
