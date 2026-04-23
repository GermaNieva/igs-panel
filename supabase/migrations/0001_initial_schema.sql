-- ==========================================================
-- IGS Panel — esquema inicial
-- Multi-tenant SaaS para bares/restaurantes.
-- Ejecutar UNA SOLA VEZ en el SQL Editor de Supabase.
-- ==========================================================

-- Extensiones
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ==========================================================
-- Enums
-- ==========================================================
create type user_role as enum ('owner', 'manager', 'waiter', 'kitchen', 'super_admin');
create type plan_status as enum ('trialing', 'active', 'past_due', 'paused', 'cancelled');
create type station as enum ('parrilla', 'caliente', 'fria', 'postres');
create type order_status as enum ('drafting', 'calling_waiter', 'confirmed', 'in_kitchen', 'ready', 'served', 'paid', 'cancelled');
create type table_status as enum ('free', 'occupied', 'called');
create type invoice_status as enum ('pending', 'paid', 'failed', 'refunded');

-- ==========================================================
-- Bars — tenant principal
-- ==========================================================
create table public.bars (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,                      -- elfogon → elfogon.igs...
  name text not null,
  tagline text,
  owner_id uuid references auth.users(id),
  logo_url text,
  cover_url text,
  welcome_msg text,
  address text,
  city text,
  socials jsonb default '{}'::jsonb,              -- {instagram, facebook, whatsapp, reservation_url}
  schedule jsonb default '[]'::jsonb,             -- array de {day, open, close, closed}
  plan_status plan_status not null default 'trialing',
  trial_ends_at timestamptz default (now() + interval '14 days'),
  mp_preapproval_id text,                         -- ID de la suscripción MP
  tax_info jsonb default '{}'::jsonb,             -- {razon_social, cuit, condicion_iva, domicilio}
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on public.bars (owner_id);

-- ==========================================================
-- Profiles — metadata por usuario, atado a auth.users
-- ==========================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  bar_id uuid references public.bars(id) on delete set null,
  role user_role not null default 'owner',
  full_name text,
  avatar_url text,
  shift text,                                     -- "Noche", "Mediodía", "Todos"
  is_active boolean default true,
  last_seen_at timestamptz,
  created_at timestamptz default now()
);
create index on public.profiles (bar_id);

-- ==========================================================
-- Carta
-- ==========================================================
create table public.categories (
  id uuid primary key default uuid_generate_v4(),
  bar_id uuid not null references public.bars(id) on delete cascade,
  name text not null,
  sort int default 0,
  created_at timestamptz default now()
);
create index on public.categories (bar_id, sort);

create table public.menu_items (
  id uuid primary key default uuid_generate_v4(),
  bar_id uuid not null references public.bars(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  description text,
  price int not null default 0,                   -- ARS entero (centavos no se usan)
  station station not null default 'caliente',
  active boolean default true,
  photo_url text,
  sort int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on public.menu_items (bar_id, category_id, sort);

create table public.menu_item_variants (
  id uuid primary key default uuid_generate_v4(),
  item_id uuid not null references public.menu_items(id) on delete cascade,
  name text not null,
  price_delta int not null default 0,             -- cuánto suma/resta vs precio base
  sort int default 0
);
create index on public.menu_item_variants (item_id);

create table public.menu_item_addons (
  id uuid primary key default uuid_generate_v4(),
  item_id uuid not null references public.menu_items(id) on delete cascade,
  name text not null,
  price_delta int not null default 0,
  sort int default 0
);
create index on public.menu_item_addons (item_id);

-- ==========================================================
-- Mesas
-- ==========================================================
create table public.zones (
  id uuid primary key default uuid_generate_v4(),
  bar_id uuid not null references public.bars(id) on delete cascade,
  name text not null,                             -- "Salón principal", "Patio"
  sort int default 0
);
create index on public.zones (bar_id);

create table public.tables (
  id uuid primary key default uuid_generate_v4(),
  bar_id uuid not null references public.bars(id) on delete cascade,
  zone_id uuid references public.zones(id) on delete set null,
  number int not null,                            -- 1, 2, 3… (único por bar)
  alias text,
  seats int default 4,
  status table_status default 'free',
  called_at timestamptz,
  created_at timestamptz default now(),
  unique(bar_id, number)
);
create index on public.tables (bar_id);

-- ==========================================================
-- Pedidos
-- ==========================================================
create table public.orders (
  id uuid primary key default uuid_generate_v4(),
  bar_id uuid not null references public.bars(id) on delete cascade,
  table_id uuid references public.tables(id) on delete set null,
  status order_status not null default 'drafting',
  waiter_id uuid references public.profiles(id) on delete set null,
  called_at timestamptz,
  sent_to_kitchen_at timestamptz,
  ready_at timestamptz,
  paid_at timestamptz,
  total int default 0,
  notes text,
  created_at timestamptz default now()
);
create index on public.orders (bar_id, status);
create index on public.orders (table_id);

create table public.order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  variant_id uuid references public.menu_item_variants(id) on delete set null,
  name_snapshot text not null,                    -- guardamos nombre/precio al momento del pedido
  unit_price int not null,
  qty int not null default 1,
  addons jsonb default '[]'::jsonb,               -- [{name, price_delta}]
  notes text,
  station station not null,
  ready_at timestamptz,
  created_at timestamptz default now()
);
create index on public.order_items (order_id);

-- ==========================================================
-- Facturación de la suscripción IGS
-- ==========================================================
create table public.invoices (
  id uuid primary key default uuid_generate_v4(),
  bar_id uuid not null references public.bars(id) on delete cascade,
  external_id text,                               -- ID de MP
  mp_payment_id text,
  amount int not null,                            -- ARS entero
  period_start date not null,
  period_end date not null,
  status invoice_status not null default 'pending',
  pdf_url text,
  paid_at timestamptz,
  created_at timestamptz default now()
);
create index on public.invoices (bar_id, period_start desc);

-- ==========================================================
-- Helper: ¿qué bar es el del usuario logueado?
-- ==========================================================
create or replace function public.current_bar_id()
returns uuid
language sql
stable
as $$
  select bar_id from public.profiles where id = auth.uid()
$$;

create or replace function public.current_role()
returns user_role
language sql
stable
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
as $$
  select coalesce((select role = 'super_admin' from public.profiles where id = auth.uid()), false)
$$;

-- ==========================================================
-- RLS — un bar nunca ve datos de otro
-- ==========================================================
alter table public.bars                enable row level security;
alter table public.profiles            enable row level security;
alter table public.categories          enable row level security;
alter table public.menu_items          enable row level security;
alter table public.menu_item_variants  enable row level security;
alter table public.menu_item_addons    enable row level security;
alter table public.zones               enable row level security;
alter table public.tables              enable row level security;
alter table public.orders              enable row level security;
alter table public.order_items         enable row level security;
alter table public.invoices            enable row level security;

-- bars: el dueño ve su bar; super_admin ve todo
create policy "bars_select" on public.bars for select
  using (id = public.current_bar_id() or public.is_super_admin());
create policy "bars_update" on public.bars for update
  using ((id = public.current_bar_id() and public.current_role() in ('owner', 'manager')) or public.is_super_admin());
create policy "bars_insert" on public.bars for insert
  with check (owner_id = auth.uid() or public.is_super_admin());
create policy "bars_delete" on public.bars for delete
  using (public.is_super_admin());

-- profiles: cada uno ve los de su bar; super_admin ve todo
create policy "profiles_select_same_bar" on public.profiles for select
  using (bar_id = public.current_bar_id() or id = auth.uid() or public.is_super_admin());
create policy "profiles_insert_self" on public.profiles for insert
  with check (id = auth.uid() or public.is_super_admin());
create policy "profiles_update" on public.profiles for update
  using (id = auth.uid() or (public.current_role() in ('owner', 'manager') and bar_id = public.current_bar_id()) or public.is_super_admin());

-- Plantilla multi-tenant para las tablas con bar_id
-- (Macro repetida — Supabase no soporta funciones genéricas sobre policies)
create policy "cat_rw" on public.categories for all
  using (bar_id = public.current_bar_id() or public.is_super_admin())
  with check (bar_id = public.current_bar_id() or public.is_super_admin());

create policy "mi_rw" on public.menu_items for all
  using (bar_id = public.current_bar_id() or public.is_super_admin())
  with check (bar_id = public.current_bar_id() or public.is_super_admin());

create policy "miv_rw" on public.menu_item_variants for all
  using (exists (select 1 from public.menu_items m where m.id = item_id and (m.bar_id = public.current_bar_id() or public.is_super_admin())))
  with check (exists (select 1 from public.menu_items m where m.id = item_id and (m.bar_id = public.current_bar_id() or public.is_super_admin())));

create policy "mia_rw" on public.menu_item_addons for all
  using (exists (select 1 from public.menu_items m where m.id = item_id and (m.bar_id = public.current_bar_id() or public.is_super_admin())))
  with check (exists (select 1 from public.menu_items m where m.id = item_id and (m.bar_id = public.current_bar_id() or public.is_super_admin())));

create policy "zones_rw" on public.zones for all
  using (bar_id = public.current_bar_id() or public.is_super_admin())
  with check (bar_id = public.current_bar_id() or public.is_super_admin());

create policy "tables_rw" on public.tables for all
  using (bar_id = public.current_bar_id() or public.is_super_admin())
  with check (bar_id = public.current_bar_id() or public.is_super_admin());

create policy "orders_rw" on public.orders for all
  using (bar_id = public.current_bar_id() or public.is_super_admin())
  with check (bar_id = public.current_bar_id() or public.is_super_admin());

create policy "order_items_rw" on public.order_items for all
  using (exists (select 1 from public.orders o where o.id = order_id and (o.bar_id = public.current_bar_id() or public.is_super_admin())))
  with check (exists (select 1 from public.orders o where o.id = order_id and (o.bar_id = public.current_bar_id() or public.is_super_admin())));

create policy "invoices_select" on public.invoices for select
  using (bar_id = public.current_bar_id() or public.is_super_admin());
create policy "invoices_write_super" on public.invoices for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ==========================================================
-- LECTURA PÚBLICA de la carta (para el cliente que escanea QR sin sesión)
-- Solo campos "vitrina", NO incluye orders ni profiles.
-- ==========================================================
create policy "public_read_active_bars" on public.bars for select to anon
  using (plan_status in ('trialing', 'active'));
create policy "public_read_categories" on public.categories for select to anon using (true);
create policy "public_read_menu_items" on public.menu_items for select to anon using (active = true);
create policy "public_read_variants" on public.menu_item_variants for select to anon using (true);
create policy "public_read_addons" on public.menu_item_addons for select to anon using (true);
create policy "public_read_tables" on public.tables for select to anon using (true);
create policy "public_read_zones" on public.zones for select to anon using (true);

-- Orders: el cliente anónimo puede crear su pedido (drafting/calling_waiter) y leer el suyo.
-- El "token" del pedido se guarda en un cookie; un bar solo acepta pedidos para sus propias mesas.
create policy "public_insert_order" on public.orders for insert to anon
  with check (status in ('drafting', 'calling_waiter') and exists (
    select 1 from public.tables t where t.id = table_id and t.bar_id = orders.bar_id
  ));
create policy "public_insert_order_items" on public.order_items for insert to anon
  with check (exists (select 1 from public.orders o where o.id = order_id and o.status in ('drafting', 'calling_waiter')));

-- ==========================================================
-- Trigger: cuando se crea un user en auth.users, crear profile
-- (los metadatos 'bar_name' y 'role' se pasan al registrarse desde la app)
-- ==========================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_bar_id uuid;
  bar_name text := coalesce(new.raw_user_meta_data ->> 'bar_name', 'Mi bar');
begin
  -- Si el user se registra con "bar_name" en metadata, creamos el bar también.
  if new.raw_user_meta_data ? 'bar_name' then
    insert into public.bars (slug, name, owner_id)
    values (
      lower(regexp_replace(bar_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(new.id::text, 1, 6),
      bar_name,
      new.id
    )
    returning id into new_bar_id;
  end if;

  insert into public.profiles (id, bar_id, role, full_name)
  values (
    new.id,
    new_bar_id,
    'owner',
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ==========================================================
-- Realtime: habilitar para KDS cocina y llamadas al mozo
-- (esto también se activa en el dashboard: Database → Replication)
-- ==========================================================
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.order_items;
alter publication supabase_realtime add table public.tables;
