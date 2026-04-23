-- ==========================================================
-- Extiende el trigger handle_new_user para soportar invitaciones de staff:
--   - Si el user trae bar_name en metadata → crea bar y profile (owner). Comportamiento actual.
--   - Si el user trae bar_id en metadata (invitación) → crea profile con ese bar_id y el rol indicado.
-- Idempotente: se puede correr varias veces.
-- ==========================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_bar_id uuid;
  bar_name text;
  invited_bar_id uuid;
  invited_role user_role;
begin
  bar_name := new.raw_user_meta_data ->> 'bar_name';
  invited_bar_id := nullif(new.raw_user_meta_data ->> 'bar_id', '')::uuid;
  invited_role := coalesce(
    nullif(new.raw_user_meta_data ->> 'role', '')::user_role,
    'owner'::user_role
  );

  if invited_bar_id is not null then
    -- Invitación de staff: usar el bar y el rol que vinieron en la invitación.
    insert into public.profiles (id, bar_id, role, full_name)
    values (
      new.id,
      invited_bar_id,
      invited_role,
      coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
    );
    return new;
  end if;

  if bar_name is not null then
    -- Registro de dueño: crear bar nuevo.
    insert into public.bars (slug, name, owner_id)
    values (
      lower(regexp_replace(bar_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(new.id::text, 1, 6),
      bar_name,
      new.id
    )
    returning id into new_bar_id;

    insert into public.profiles (id, bar_id, role, full_name)
    values (
      new.id,
      new_bar_id,
      'owner',
      coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
    );
    return new;
  end if;

  -- Sin bar_name ni bar_id: profile huérfano (ej. signup directo en Supabase auth UI).
  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    'owner',
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

-- El trigger ya existe del 0001, pero por las dudas:
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
