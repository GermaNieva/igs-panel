import { createHmac, timingSafeEqual } from "node:crypto";

// Verifica la firma HMAC-SHA256 de un webhook de MercadoPago.
// MP manda `x-signature` con formato `ts=<unix>,v1=<hash>` y `x-request-id`.
// El manifest a firmar es: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
// (el `data.id` se toma del query string, NO del body).
//
// Configurar MP_WEBHOOK_SECRET en envs. Se genera en MP Dashboard:
//   Tu app → Webhooks → editar URL → "Generar clave secreta".

export type WebhookVerifyResult =
  | { ok: true }
  | { ok: false; reason: string };

const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutos contra replay attacks

export function verifyMpWebhookSignature(opts: {
  signatureHeader: string | null;
  requestIdHeader: string | null;
  dataId: string | null; // tomado del query string ?data.id=...
  secret: string;
}): WebhookVerifyResult {
  if (!opts.signatureHeader) return { ok: false, reason: "missing x-signature header" };
  if (!opts.requestIdHeader) return { ok: false, reason: "missing x-request-id header" };
  if (!opts.dataId) return { ok: false, reason: "missing data.id" };
  if (!opts.secret) return { ok: false, reason: "MP_WEBHOOK_SECRET not configured" };

  // Parsear `ts=...,v1=...`
  const parts = opts.signatureHeader.split(",").map((p) => p.trim());
  let ts: string | null = null;
  let v1: string | null = null;
  for (const p of parts) {
    const [k, ...rest] = p.split("=");
    const val = rest.join("=");
    if (k === "ts") ts = val;
    else if (k === "v1") v1 = val;
  }
  if (!ts || !v1) return { ok: false, reason: "malformed x-signature header" };

  // Replay protection: rechazar webhooks viejos.
  const tsMs = parseInt(ts, 10) * 1000;
  if (!Number.isFinite(tsMs)) return { ok: false, reason: "invalid ts" };
  const drift = Math.abs(Date.now() - tsMs);
  if (drift > MAX_AGE_MS) return { ok: false, reason: "ts out of window (replay?)" };

  // Construir manifest según spec de MP y hashear.
  const manifest = `id:${opts.dataId};request-id:${opts.requestIdHeader};ts:${ts};`;
  const expected = createHmac("sha256", opts.secret).update(manifest).digest("hex");

  // Comparación timing-safe — evita side-channel para inferir bytes del hash.
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(v1, "utf8");
  if (a.length !== b.length) return { ok: false, reason: "signature length mismatch" };
  if (!timingSafeEqual(a, b)) return { ok: false, reason: "signature mismatch" };

  return { ok: true };
}
