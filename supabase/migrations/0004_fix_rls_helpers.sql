-- ==========================================================
-- Fix de recursión RLS en helpers
--
-- Las funciones current_bar_id() / current_role() / is_super_admin()
-- consultan public.profiles. Cuando se usan dentro de las propias policies
-- de profiles, se dispara una recursión que en Postgres termina retornando
-- NULL en silencio — y la app ve "Tu cuenta no tiene un bar asociado"
-- aunque el bar_id esté seteado en la base.
--
-- La solución: marcar los helpers como SECURITY DEFINER para que ejecuten
-- con permisos del owner (bypass RLS) al evaluar la policy.
-- ==========================================================

create or replace function public.current_bar_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select bar_id from public.profiles where id = auth.uid()
$$;

create or replace function public.current_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'super_admin' from public.profiles where id = auth.uid()),
    false
  )
$$;

-- Reasegurar permisos: cualquier rol autenticado puede invocarlas
grant execute on function public.current_bar_id() to authenticated, anon;
grant execute on function public.current_role() to authenticated, anon;
grant execute on function public.is_super_admin() to authenticated, anon;
