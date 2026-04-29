import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPreapproval, getAuthorizedPayment } from "@/lib/mercadopago";
import { verifyMpWebhookSignature } from "@/lib/mp-webhook-verify";

// Webhook de MercadoPago. Configurar la URL pública en:
// MP Dashboard → Tu app → Webhooks → URL: https://TU-DOMINIO/api/mp-webhook
// Eventos a suscribir: "subscription_preapproval" y "subscription_authorized_payment".
//
// La firma HMAC-SHA256 de cada webhook se valida contra MP_WEBHOOK_SECRET (se
// genera en MP Dashboard → Webhooks → editar URL → "Generar clave secreta").
// Sin secret configurado, rechazamos todos los webhooks en producción para
// evitar que un atacante active suscripciones falsas.

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  // Importante: el `data.id` para el manifest de la firma se toma del query
  // string, no del body. (Spec de MP.)
  const dataIdFromQuery = url.searchParams.get("data.id");
  const typeFromQuery = url.searchParams.get("type");

  const secret = process.env.MP_WEBHOOK_SECRET;
  const isProd = process.env.NODE_ENV === "production";

  // Verificar firma. En dev sin secret seteado dejamos pasar para poder
  // probar con la herramienta del dashboard de MP, pero logueamos.
  if (secret) {
    const verify = verifyMpWebhookSignature({
      signatureHeader: req.headers.get("x-signature"),
      requestIdHeader: req.headers.get("x-request-id"),
      dataId: dataIdFromQuery,
      secret,
    });
    if (!verify.ok) {
      console.warn("[mp-webhook] signature rejected:", verify.reason);
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  } else if (isProd) {
    console.error("[mp-webhook] MP_WEBHOOK_SECRET not configured in production — rejecting");
    return NextResponse.json({ ok: false }, { status: 401 });
  } else {
    console.warn("[mp-webhook] DEV: skipping signature verification (no MP_WEBHOOK_SECRET)");
  }

  let body: { type?: string; action?: string; data?: { id?: string } } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const type = body.type ?? typeFromQuery ?? "";
  const id = body.data?.id ?? dataIdFromQuery ?? "";

  console.log("[mp-webhook]", { type, action: body.action, id });

  if (!id) {
    return NextResponse.json({ ok: true, note: "no id" });
  }

  try {
    if (type === "subscription_preapproval") {
      await handlePreapprovalEvent(id);
    } else if (type === "subscription_authorized_payment" || type === "authorized_payment") {
      await handleAuthorizedPaymentEvent(id);
    }
  } catch (e) {
    console.error("[mp-webhook] error:", e);
    // Devolvemos 200 igual para que MP no reintente eternamente.
    return NextResponse.json({ ok: false });
  }

  return NextResponse.json({ ok: true });
}

async function handlePreapprovalEvent(preapprovalId: string) {
  const pre = await getPreapproval(preapprovalId);
  const barId = pre.external_reference;
  if (!barId) return;

  const admin = createAdminClient();

  // Regla: `authorized` siempre toma control — es el estado deseado y reescribe
  // mp_preapproval_id al id del preapproval autorizado. Esto evita que un
  // evento `cancelled` de un intento rechazado anterior pise un `authorized`
  // posterior si llegan fuera de orden.
  if (pre.status === "authorized") {
    await admin
      .from("bars")
      .update({
        plan_status: "active",
        mp_preapproval_id: pre.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", barId);
    return;
  }

  // Para `paused` / `cancelled` solo aplicamos si el evento corresponde al
  // preapproval actual del bar. Eventos de preapprovals abandonados/rechazados
  // viejos se ignoran.
  const { data: bar } = await admin
    .from("bars")
    .select("mp_preapproval_id")
    .eq("id", barId)
    .maybeSingle();
  if (!bar) return;
  if (bar.mp_preapproval_id !== pre.id) return;

  const newStatus =
    pre.status === "paused"
      ? "paused"
      : pre.status === "cancelled"
      ? "cancelled"
      : null;

  if (!newStatus) return;

  await admin
    .from("bars")
    .update({ plan_status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", barId);
}

async function handleAuthorizedPaymentEvent(authorizedPaymentId: string) {
  const ap = await getAuthorizedPayment(authorizedPaymentId);
  const pre = await getPreapproval(ap.preapproval_id);
  const barId = pre.external_reference;
  if (!barId) return;

  const admin = createAdminClient();

  const isPaid = ap.payment_state === "approved";
  const isFailed = ap.payment_state === "rejected";

  // Crear o actualizar la fila en invoices
  const periodStart = ap.date_created.slice(0, 10);
  // Asumir 1 mes
  const periodEndDate = new Date(ap.date_created);
  periodEndDate.setMonth(periodEndDate.getMonth() + 1);
  const periodEnd = periodEndDate.toISOString().slice(0, 10);

  const { data: existing } = await admin
    .from("invoices")
    .select("id")
    .eq("external_id", String(ap.id))
    .maybeSingle();

  const invoiceRow = {
    bar_id: barId,
    external_id: String(ap.id),
    mp_payment_id: ap.payment_id ? String(ap.payment_id) : null,
    amount: ap.transaction_amount,
    period_start: periodStart,
    period_end: periodEnd,
    status: (isPaid ? "paid" : isFailed ? "failed" : "pending") as "paid" | "failed" | "pending",
    paid_at: isPaid ? new Date(ap.last_modified).toISOString() : null,
  };

  if (existing) {
    await admin.from("invoices").update(invoiceRow).eq("id", existing.id);
  } else {
    await admin.from("invoices").insert(invoiceRow);
  }

  // Si el pago se aprobó, asegurar plan_status='active'
  // Si falló, marcar past_due (solo si es el preapproval current)
  if (isPaid) {
    await admin
      .from("bars")
      .update({ plan_status: "active", mp_preapproval_id: pre.id })
      .eq("id", barId);
  } else if (isFailed) {
    const { data: bar } = await admin
      .from("bars")
      .select("mp_preapproval_id")
      .eq("id", barId)
      .maybeSingle();
    if (bar?.mp_preapproval_id === pre.id) {
      await admin.from("bars").update({ plan_status: "past_due" }).eq("id", barId);
    }
  }
}
