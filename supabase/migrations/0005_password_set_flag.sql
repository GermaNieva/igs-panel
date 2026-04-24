-- ==========================================================
-- Flag password_set para diferenciar usuarios invitados (sin contraseña)
-- de usuarios que se registraron normalmente (con contraseña).
--
-- Permite que el callback de auth decida si llevar al usuario a
-- /configurar-cuenta o directamente a su panel correspondiente.
-- ==========================================================

alter table public.profiles
  add column if not exists password_set boolean not null default false;

-- Marcar como true a todos los usuarios EXISTENTES con role 'owner' o 'super_admin'
-- (que se registraron con contraseña en /ingresar).
update public.profiles
  set password_set = true
  where role in ('owner', 'super_admin');

-- Actualizar el trigger para setear password_set al crear el profile
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
    -- Invitación de staff: profile sin contraseña, va a tener que ponerla.
    insert into public.profiles (id, bar_id, role, full_name, password_set)
    values (
      new.id,
      invited_bar_id,
      invited_role,
      coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
      false
    );
    return new;
  end if;

  if bar_name is not null then
    -- Registro de dueño: ya tiene contraseña.
    insert into public.bars (slug, name, owner_id)
    values (
      lower(regexp_replace(bar_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(new.id::text, 1, 6),
      bar_name,
      new.id
    )
    returning id into new_bar_id;

    insert into public.profiles (id, bar_id, role, full_name, password_set)
    values (
      new.id,
      new_bar_id,
      'owner',
      coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
      true
    );
    return new;
  end if;

  insert into public.profiles (id, role, full_name, password_set)
  values (
    new.id,
    'owner',
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    true
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
