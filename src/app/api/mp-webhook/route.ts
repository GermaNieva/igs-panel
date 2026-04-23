import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPreapproval, getAuthorizedPayment } from "@/lib/mercadopago";

// Webhook de MercadoPago. Configurar la URL pública en:
// MP Dashboard → Tu app → Webhooks → URL: https://TU-DOMINIO/api/mp-webhook
// Eventos a suscribir: "subscription_preapproval" y "subscription_authorized_payment".

export async function POST(req: NextRequest) {
  let body: { type?: string; action?: string; data?: { id?: string } } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const type = body.type ?? new URL(req.url).searchParams.get("type") ?? "";
  const id = body.data?.id ?? new URL(req.url).searchParams.get("data.id") ?? "";

  // Log básico para debug
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
    return NextResponse.json({ ok: false, error: String(e) });
  }

  return NextResponse.json({ ok: true });
}

// También aceptar GET por compatibilidad con el "Probar webhook" del dashboard de MP
export async function GET(req: NextRequest) {
  return POST(req);
}

async function handlePreapprovalEvent(preapprovalId: string) {
  const pre = await getPreapproval(preapprovalId);
  const barId = pre.external_reference;
  if (!barId) return;

  const admin = createAdminClient();
  const newStatus =
    pre.status === "authorized"
      ? "active"
      : pre.status === "paused"
      ? "paused"
      : pre.status === "cancelled"
      ? "cancelled"
      : "trialing";

  await admin
    .from("bars")
    .update({
      plan_status: newStatus,
      mp_preapproval_id: pre.id,
      updated_at: new Date().toISOString(),
    })
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
  // Si falló, marcar past_due
  if (isPaid) {
    await admin.from("bars").update({ plan_status: "active" }).eq("id", barId);
  } else if (isFailed) {
    await admin.from("bars").update({ plan_status: "past_due" }).eq("id", barId);
  }
}
