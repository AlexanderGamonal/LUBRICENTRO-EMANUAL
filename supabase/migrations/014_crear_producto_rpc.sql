-- 014_crear_producto_rpc.sql
-- RPC atomica: crea un producto con stock = 0 y registra la entrada inicial.
-- Elimina la race condition de ProductoFormPage e ImportacionPage donde
-- el INSERT del producto y el registrar_movimiento_stock ocurrian en pasos
-- separados, pudiendo dejar el stock en 0 si el segundo paso fallaba.
-- Aplicar en: Supabase Dashboard > SQL Editor

-- ============================================================
-- RPC: crear_producto
-- Inserta el producto (stock_actual siempre arranca en 0) y,
-- si stock_inicial > 0, registra la entrada en movimientos_stock.
-- Retorna el id del producto creado.
-- ============================================================
create or replace function crear_producto(
  p_sucursal_id              uuid,
  p_codigo_interno           text,
  p_nombre                   text,
  p_precio_venta             numeric,
  p_costo                    numeric,
  p_stock_inicial            integer  default 0,
  p_stock_minimo             integer  default 0,
  p_categoria_id             uuid     default null,
  p_ubicacion_id             uuid     default null,
  p_codigo_barras            text     default null,
  p_marca                    text     default null,
  p_viscosidad_especificacion text    default null,
  p_tiene_codigo_barras      boolean  default false,
  p_foto_url                 text     default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id  uuid;
  v_rol         text;
  v_producto_id uuid;
begin
  v_usuario_id := current_usuario_id();
  v_rol        := current_user_role();

  -- Solo admin, superadmin y almacen pueden crear productos
  if v_usuario_id is null then
    raise exception ''Usuario no autenticado'';
  end if;
  if v_rol not in (''admin'', ''superadmin'', ''almacen'') then
    raise exception ''Sin permisos para crear productos. Rol actual: %'', v_rol;
  end if;

  -- Verificar que la sucursal sea la del usuario (superadmin puede crear en cualquiera)
  if v_rol <> ''superadmin'' and p_sucursal_id <> current_sucursal_id() then
    raise exception ''No puedes crear productos en otra sucursal'';
  end if;

  if p_stock_inicial < 0 then
    raise exception ''El stock inicial no puede ser negativo'';
  end if;

  if p_precio_venta < 0 then
    raise exception ''El precio de venta no puede ser negativo'';
  end if;

  if p_costo < 0 then
    raise exception ''El costo no puede ser negativo'';
  end if;

  -- Insertar producto con stock_actual = 0 siempre
  insert into productos (
    sucursal_id,
    categoria_id,
    ubicacion_id,
    codigo_interno,
    codigo_barras,
    nombre,
    marca,
    viscosidad_especificacion,
    precio_venta,
    costo,
    stock_actual,
    stock_minimo,
    tiene_codigo_barras,
    foto_url,
    activo
  ) values (
    p_sucursal_id,
    p_categoria_id,
    p_ubicacion_id,
    p_codigo_interno,
    nullif(p_codigo_barras, ''''),
    p_nombre,
    nullif(p_marca, ''''),
    nullif(p_viscosidad_especificacion, ''''),
    p_precio_venta,
    p_costo,
    0,  -- stock siempre comienza en 0
    coalesce(p_stock_minimo, 0),
    coalesce(p_tiene_codigo_barras, false),
    nullif(p_foto_url, ''''),
    true
  )
  returning id into v_producto_id;

  -- Si hay stock inicial, registrarlo como entrada (atomico en la misma tx)
  if p_stock_inicial > 0 then
    perform registrar_movimiento_stock(
      v_producto_id,
      ''entrada'',
      p_stock_inicial,
      ''Stock inicial al crear producto'',
      ''productos'',
      v_producto_id
    );
  end if;

  insert into auditoria_eventos (
    sucursal_id, usuario_id, entidad, entidad_id, accion, datos_nuevos
  ) values (
    p_sucursal_id, v_usuario_id, ''productos'', v_producto_id, ''crear_producto'',
    jsonb_build_object(
      ''codigo_interno'',  p_codigo_interno,
      ''nombre'',          p_nombre,
      ''precio_venta'',    p_precio_venta,
      ''costo'',           p_costo,
      ''stock_inicial'',   p_stock_inicial
    )
  );

  return jsonb_build_object(
    ''producto_id'',   v_producto_id,
    ''stock_inicial'', p_stock_inicial
  );
end;
$$;
