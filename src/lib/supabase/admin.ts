import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente con SERVICE_ROLE_KEY — bypass de RLS.
 * Usar SOLO en código server-side de IGS (server actions, route handlers, jobs).
 * Nunca exponer al navegador.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
