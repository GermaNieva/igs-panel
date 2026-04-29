import "server-only";
import { createAdminClient } from "./supabase/admin";

// Rate limiting basado en la tabla `rate_limits` + función atomic
// `check_rate_limit` (ver migración 0008).
//
// Uso:
//   const ok = await checkRateLimit(`call-waiter:${barId}:${tableId}`, 5, 300);
//   if (!ok) return { ok: false, error: "..." };
//
// Si la DB falla por algún motivo, hacemos fail-open (dejamos pasar) — un rate
// limit roto no debería tirar abajo el endpoint principal. Si esto se vuelve un
// problema, cambiar a fail-closed.
export async function checkRateLimit(
  key: string,
  max: number,
  windowSeconds: number
): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("check_rate_limit", {
      p_key: key,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error("[rate-limit] rpc error:", error.message);
      return true; // fail-open
    }
    return data === true;
  } catch (e) {
    console.error("[rate-limit] unexpected:", e);
    return true; // fail-open
  }
}

// Extrae una IP "razonable" del request para usar como rate limit key.
// Netlify mete la IP del cliente en `x-forwarded-for`; si hay varios, el
// primero es el client. Si no la encontramos, devolvemos "unknown" (compartido).
export function clientIpFromHeaders(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}
