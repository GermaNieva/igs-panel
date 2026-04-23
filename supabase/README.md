# Setup de Supabase para IGS Panel

## 1. Crear cuenta y proyecto

1. Andá a <https://supabase.com> → Sign up con Google (te conviene usar **igs.solucionesweb@gmail.com** para que quede bajo IGS).
2. New project:
   - **Name:** `igs-panel`
   - **Database password:** generala fuerte y guardala en un gestor de contraseñas
   - **Region:** `São Paulo (sa-east-1)` — es la más cercana a Argentina
   - **Plan:** Free (después pasás a Pro cuando tengas más de 5 bares)
3. Esperá 2 minutos a que provisione.

## 2. Correr la migración inicial

1. En el dashboard de Supabase → **SQL Editor** → New query
2. Copiá todo el contenido de [`migrations/0001_initial_schema.sql`](migrations/0001_initial_schema.sql)
3. Pegalo y tocá **Run** (Ctrl+Enter)
4. Deberías ver "Success. No rows returned."

Esto crea:
- 11 tablas (`bars`, `profiles`, `categories`, `menu_items`, `menu_item_variants`, `menu_item_addons`, `zones`, `tables`, `orders`, `order_items`, `invoices`)
- Enums (`user_role`, `plan_status`, `station`, `order_status`, `table_status`, `invoice_status`)
- Helpers: `current_bar_id()`, `current_role()`, `is_super_admin()`
- **RLS multi-tenant** — cada bar solo ve lo suyo, automáticamente
- **Trigger de registro** — cuando alguien se registra con `bar_name` en metadata, se crea el bar y el profile
- **Realtime** habilitado en `orders`, `order_items`, `tables` (para KDS)

## 3. Configurar auth

### Email + contraseña
Ya viene activado. Andá a **Authentication → Providers → Email** y:
- Confirmación de email: desactivala para desarrollo (reactivala en prod)
- Recuperación de contraseña: activada

### Google OAuth
1. Andá a <https://console.cloud.google.com> (misma cuenta igs.solucionesweb@gmail.com)
2. Crear proyecto "IGS Panel"
3. APIs & Services → OAuth consent screen:
   - Tipo: External
   - Nombre: "IGS Panel"
   - Email soporte: igs.solucionesweb@gmail.com
4. APIs & Services → Credentials → Create OAuth client ID:
   - Tipo: Web application
   - **Authorized redirect URI:** `https://<TU-REF>.supabase.co/auth/v1/callback` (copialo desde Supabase → Authentication → Providers → Google)
5. Copiá Client ID y Client Secret, pegalos en Supabase → Providers → Google y activá.

## 4. Copiar las claves al proyecto

En Supabase → **Project Settings → API**:

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role secret** → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ nunca subir a git, ni exponerla al navegador)

Pegalos en `.env.local` siguiendo [`.env.local.example`](../.env.local.example).

## 5. Darte rol super_admin a vos mismo

Después del primer registro desde el panel, ejecutá en el SQL Editor:

```sql
update public.profiles
set role = 'super_admin'
where id = (select id from auth.users where email = 'igs.solucionesweb@gmail.com');
```

Ahora podés entrar a `/super-admin` y ver todos los bares de la red.

## 6. (Después, con datos reales) Storage para logos y fotos

En **Storage → Create a new bucket**:

- **`bar-assets`** (público) — logos y portadas de cada bar
- **`menu-photos`** (público) — fotos de platos

Policies (en Storage → Policies):

```sql
-- Todos leen (es vitrina pública)
create policy "public_read_bar_assets" on storage.objects for select
  to public using (bucket_id = 'bar-assets');

create policy "public_read_menu_photos" on storage.objects for select
  to public using (bucket_id = 'menu-photos');

-- Solo el dueño/encargado del bar sube/modifica
create policy "bar_staff_write_bar_assets" on storage.objects for all
  to authenticated using (
    bucket_id = 'bar-assets'
    and (storage.foldername(name))[1] = (select current_bar_id()::text)
  );
```

Los archivos van con path `{bar_id}/logo.png`, `{bar_id}/cover.jpg`, etc.

## Problemas comunes

- **"new row violates row-level security policy"** → el usuario no tiene profile, o el profile no tiene `bar_id`. Chequeá `select * from profiles where id = auth.uid()` logueado.
- **Trigger no se dispara** → asegurate de que `on_auth_user_created` esté en la lista: `select * from pg_trigger where tgname = 'on_auth_user_created'`.
- **Realtime no llega** → en el dashboard, Database → Replication, verificá que `orders`/`order_items`/`tables` estén publicadas.
