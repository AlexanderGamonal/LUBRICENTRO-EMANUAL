-- 019_cierre_caja_por_medio.sql
-- Cierre de caja: el "esperado" es solo el efectivo del cajón.
-- Antes: apertura + todos los ingresos (Yape, tarjeta, etc. incluidos) - egresos, lo que
-- generaba faltantes falsos. Ahora: apertura + ingresos en efectivo - egresos en efectivo.
-- Los demás medios se informan por separado (resumen_caja) para conciliar con billetera/banco.

-- 1. El esperado en efectivo puede ser negativo si hubo devoluciones de ventas de un turno anterior.
do $$
declare v_con text;
begin
  for v_con in
    select c.conname from pg_constraint c
    where c.conrelid = 'public.cajas'::regclass and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%monto_cierre_esperado%'
  loop
    execute format('alter table public.cajas drop constraint %I', v_con);
  end loop;
end $$;

-- 2. resumen_caja: ingresos, egresos y neto por medio de pago + créditos otorgados en el turno.
create or replace function resumen_caja(p_caja_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_sucursal_id uuid := current_sucursal_id();
  v_caja        cajas;
  v_medios      jsonb;
  v_credito     numeric;
begin
  if current_usuario_id() is null then raise exception 'No autenticado'; end if;

  select * into v_caja from cajas where id = p_caja_id and sucursal_id = v_sucursal_id;
  if not found then raise exception 'Caja no encontrada o no pertenece a esta sucursal'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'medio', m.medio, 'ingresos', m.ingresos, 'egresos', m.egresos, 'neto', m.ingresos - m.egresos
         ) order by case m.medio when 'efectivo' then 0 else 1 end, m.medio), '[]'::jsonb)
  into v_medios
  from (
    select medio_pago::text as medio,
           coalesce(sum(monto) filter (where tipo = 'ingreso'), 0) as ingresos,
           coalesce(sum(monto) filter (where tipo = 'egreso'), 0) as egresos
    from caja_movimientos
    where caja_id = p_caja_id
    group by medio_pago
  ) m;

  -- Créditos otorgados durante el turno (saldo por cobrar), de ventas y de servicios.
  select coalesce(sum(saldo), 0) into v_credito
  from creditos_cliente
  where sucursal_id = v_sucursal_id
    and created_at >= v_caja.opened_at
    and (v_caja.closed_at is null or created_at <= v_caja.closed_at);

  return jsonb_build_object(
    'monto_apertura', v_caja.monto_apertura,
    'medios', v_medios,
    'credito_por_cobrar', v_credito
  );
end;
$$;

revoke execute on function resumen_caja(uuid) from public, anon;
grant execute on function resumen_caja(uuid) to authenticated;

-- 3. cerrar_caja: esperado = apertura + neto en efectivo.
create or replace function cerrar_caja(
  p_caja_id         uuid,
  p_monto_real      numeric,
  p_observaciones   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id    uuid;
  v_sucursal_id   uuid;
  v_caja          cajas;
  v_esperado      numeric;
  v_digital       numeric;
  v_diferencia    numeric;
begin
  v_usuario_id  := current_usuario_id();
  v_sucursal_id := current_sucursal_id();

  if p_monto_real is null or p_monto_real < 0 then
    raise exception 'El monto contado no puede ser negativo';
  end if;

  select * into v_caja
  from cajas
  where id = p_caja_id
    and sucursal_id = v_sucursal_id
    and estado = 'abierta'
  for update;

  if not found then
    raise exception 'Caja no encontrada, no pertenece a esta sucursal o ya está cerrada';
  end if;

  select v_caja.monto_apertura + coalesce(sum(
           case when tipo = 'ingreso' then monto else -monto end
         ) filter (where medio_pago = 'efectivo'), 0),
         coalesce(sum(
           case when tipo = 'ingreso' then monto else -monto end
         ) filter (where medio_pago <> 'efectivo'), 0)
  into v_esperado, v_digital
  from caja_movimientos
  where caja_id = p_caja_id;

  v_diferencia := p_monto_real - v_esperado;

  update cajas set
    monto_cierre_esperado = v_esperado,
    monto_cierre_real     = p_monto_real,
    diferencia            = v_diferencia,
    estado                = 'cerrada',
    observaciones         = p_observaciones,
    closed_at             = now(),
    updated_at            = now()
  where id = p_caja_id;

  insert into auditoria_eventos (sucursal_id, usuario_id, entidad, entidad_id, accion, datos_anteriores, datos_nuevos)
  values (v_sucursal_id, v_usuario_id, 'cajas', p_caja_id, 'cerrar_caja',
    jsonb_build_object('estado', 'abierta', 'monto_apertura', v_caja.monto_apertura),
    jsonb_build_object('monto_esperado_efectivo', v_esperado, 'monto_real', p_monto_real,
                       'diferencia', v_diferencia, 'total_digital', v_digital));

  return jsonb_build_object(
    'caja_id',          p_caja_id,
    'monto_apertura',   v_caja.monto_apertura,
    'monto_esperado',   v_esperado,
    'monto_real',       p_monto_real,
    'diferencia',       v_diferencia,
    'total_digital',    v_digital
  );
end;
$$;

revoke execute on function cerrar_caja(uuid, numeric, text) from public, anon;
grant execute on function cerrar_caja(uuid, numeric, text) to authenticated;
