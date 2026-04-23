# IGS Panel

SaaS multi-bar de IGS Soluciones Web. Permite que cada bar se dé de alta, configure su carta con QR por mesa, administre su equipo y pague una suscripción mensual de $30.000 ARS.

Basado en el handoff de Claude Design (ver `../design_extract/`).

## Stack

- **Next.js 15** (App Router) + TypeScript + Tailwind v4
- **Supabase** — auth (email/pass + Google), Postgres multi-tenant con RLS, Storage para logos/fotos, Realtime para KDS y llamadas al mozo
- **MercadoPago PreApproval** — cobro recurrente en ARS
- **qrcode.react** — QR de mesa y QR general del bar
- **Netlify** — hosting del panel y la carta pública bajo `igs-solucionesweb`

## Estructura

```
src/
  app/
    (panel)/             # rutas protegidas con shell (sidebar + topbar)
      layout.tsx
      dashboard/         # home del dueño
      carta/             # ABM categorías / platos / variantes / adicionales
      mesas/             # plano del salón + QR por mesa + QR general + llamadas
      equipo/            # staff con roles y permisos
      mi-bar/            # identidad pública (logo, portada, horarios, redes)
      suscripcion/       # plan, método de pago, facturas
    super-admin/         # red IGS — solo rol super_admin
    ingresar/            # login / registro
    page.tsx             # redirige a /ingresar o /dashboard según sesión
  components/
    ui/                  # IGSButton, IGSCard, IGSBadge, IGSInput, IGSLogo
    shell/IGSShell.tsx   # sidebar + topbar
  lib/
    tokens.ts            # paleta IGS, formatARS, STATIONS
    supabase/            # clientes browser y server
```

## Setup local

1. Copiá las variables: `cp .env.local.example .env.local` y completá los valores.
2. Instalá dependencias: `npm install`
3. Dev server: `npm run dev` → <http://localhost:3000>

**Sin `.env.local` real, el login y las consultas a Supabase fallan, pero las pantallas estáticas se ven.** Por ahora, al tocar "Ingresar" te lleva al dashboard con datos de demo.

## Cuentas que hay que crear (pendientes)

- [ ] **Supabase** — <https://supabase.com>, proyecto nuevo en región São Paulo (más cerca de AR). Anotar URL, anon key y service role key.
- [ ] **MercadoPago Developers** — <https://www.mercadopago.com.ar/developers>. Crear app y un **PreApproval Plan** de $30.000 ARS/mes.
- [ ] **Google Cloud** (opcional) — OAuth consent + credenciales 2.0. Se conectan dentro de Supabase Auth → Providers.
- [x] **Netlify** — ya existe (cuenta de igs-solucionesweb).

## Esquema de base de datos (próximo paso)

Tablas previstas:

- `bars` (slug, name, owner_id, plan_status, trial_ends_at, logo_url, cover_url, welcome_msg, address, socials jsonb)
- `users` (auth.users.id, bar_id, role enum: owner/manager/waiter/kitchen/super_admin)
- `categories` (bar_id, name, sort)
- `menu_items` (bar_id, category_id, name, description, price, station, active, photo_url, sort)
- `menu_item_variants` (item_id, name, price_delta)
- `menu_item_addons` (item_id, name, price_delta)
- `tables` (bar_id, number, seats, zone, slug)
- `orders` (bar_id, table_id, status, called_at, sent_to_kitchen_at, paid_at, total)
- `order_items` (order_id, menu_item_id, variant_id, qty, notes, addons jsonb, station, ready_at)
- `invoices` (bar_id, mp_payment_id, amount, period_start, period_end, status, pdf_url)

**RLS:** cada query filtra por `bar_id = auth.jwt() ->> 'bar_id'`. El rol `super_admin` puede ver todos.

## Despliegue a Netlify

```bash
# desde la carpeta igs-panel/
netlify init        # seleccionar team igs-solucionesweb
netlify deploy --build
netlify deploy --prod
```

Dominios previstos:

- `panel.igs-solucionesweb.com` — panel de administración (este repo)
- `admin.igs-solucionesweb.com` — super-admin IGS (misma app, ruta `/super-admin`)
- `carta.igs-solucionesweb.com/<slug-bar>/m/<mesa>` — carta pública escaneada

Las env vars se configuran en `Netlify → Site settings → Environment variables`. Misma lista que `.env.local.example`.

## Lo que falta para un producto completo

1. **Carta pública del cliente** (`/carta/[bar]/[mesa]`) — vista que abre el cliente al escanear el QR, con catálogo + "Llamar al mozo".
2. **Vista mozo (celular)** — bandeja de llamadas, confirmación de pedido y envío a cocina.
3. **KDS Cocina** — pantalla grande con una tarjeta por mesa y tiempos por estación (Realtime desde Supabase).
4. **Supabase schema + RLS** — correr migraciones, configurar policies, conectar auth real.
5. **MercadoPago PreApproval** — checkout de suscripción, webhook para actualizar `plan_status`.
6. **Middleware de sesión** — refrescar cookies, redirigir si no hay sesión, corte de acceso si el plan está vencido.
7. **Super-admin gate** — sólo usuarios con rol `super_admin` pueden entrar a `/super-admin`.
8. **Onboarding** — al registrarse, wizard para cargar las primeras categorías y 2-3 platos.
