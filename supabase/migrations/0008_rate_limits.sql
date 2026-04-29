-- Rate limiting basado en una tabla con función atomic.
-- Usado para proteger endpoints públicos (carta del cliente, webhook MP).

create table if not exists public.rate_limits (
  key text primary key,
  count int not null default 0,
  window_start timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Función atomic: incrementa el contador para `p_key`. Si la ventana
-- (`p_window_seconds` segundos) ya pasó, la resetea. Devuelve true si
-- el caller está dentro del límite, false si excedió.
create or replace function public.check_rate_limit(
  p_key text,
  p_max int,
  p_window_seconds int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_window_start timestamptz;
  v_now timestamptz := now();
begin
  insert into public.rate_limits (key, count, window_start)
  values (p_key, 1, v_now)
  on conflict (key) do update
    set
      count = case
        when public.rate_limits.window_start < v_now - make_interval(secs => p_window_seconds)
          then 1
        else public.rate_limits.count + 1
      end,
      window_start = case
        when public.rate_limits.window_start < v_now - make_interval(secs => p_window_seconds)
          then v_now
        else public.rate_limits.window_start
      end,
      updated_at = v_now
  returning count, window_start into v_count, v_window_start;

  return v_count <= p_max;
end;
$$;

-- RLS off — solo accedida por service_role desde el server.
alter table public.rate_limits enable row level security;
-- Política deny-all (no expuesta a clientes).
-- (Service role bypasea RLS automáticamente.)

-- Cleanup: borrar entries viejas cada tanto. Lo hacemos best-effort en cada
-- llamada en lugar de requerir cron job; entries de >24h se borran cuando
-- alguien hace check_rate_limit (bonus en la función). Por ahora dejamos
-- que crezca y agregamos cleanup más adelante si hace falta.
