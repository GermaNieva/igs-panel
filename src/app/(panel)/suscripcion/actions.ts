"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  cancelPreapproval,
  pausePreapproval,
  resumePreapproval,
  getCheckoutUrlForPlan,
  searchPreapprovalsByExternalRef,
  searchAuthorizedPaymentsByPreapproval,
} from "@/lib/mercadopago";

type Result<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

type Ctx =
  | { ok: false; error: string }
  | {
      ok: true;
      barId: string;
      supabase: Awaited<ReturnType<typeof createClient>>;
    };

async function ctxFor(): Promise<Ctx> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No estás logueado." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("bar_id, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.bar_id) return { ok: false, error: "Tu cuenta no tiene un bar asociado." };
  if (!["owner", "super_admin"].includes(profile.role)) {
    return { ok: false, error: "Solo el dueño del bar puede gestionar la suscripción." };
  }
  return { ok: true, barId: profile.bar_id, supabase };
}

export async function startSubscriptionAction(): Promise<Result<{ init_point: string }>> {
  const ctx = await ctxFor();
  if (!ctx.ok) return ctx;

  const planId = process.env.MP_PREAPPROVAL_PLAN_ID;
  if (!planId) {
    return {
      ok: false,
      error: "El plan de MercadoPago aún no está configurado. Avisanos a soporte.",
    };
  }

  const { data: bar } = await ctx.supabase
    .from("bars")
    .select("plan_status")
    .eq("id", ctx.barId)
    .maybeSingle();
  if (!bar) return { ok: false, error: "No se encontró el bar." };

  if (bar.plan_status === "active") {
    return { ok: false, error: "Tu plan ya está activo." };
  }

  const initPoint = getCheckoutUrlForPlan({ planId, barId: ctx.barId });
  return { ok: true, data: { init_point: initPoint } };
}

export async function cancelSubscriptionAction(): Promise<Result> {
  const ctx = await ctxFor();
  if (!ctx.ok) return ctx;

  const { data: bar } = await ctx.supabase
    .from("bars")
    .select("mp_preapproval_id")
    .eq("id", ctx.barId)
    .maybeSingle();
  if (!bar?.mp_preapproval_id) return { ok: false, error: "No tenés suscripción activa." };

  try {
    await cancelPreapproval(bar.mp_preapproval_id);
    const admin = createAdminClient();
    await admin
      .from("bars")
      .update({ plan_status: "cancelled" })
      .eq("id", ctx.barId);
    revalidatePath("/suscripcion");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: humanizeMpError(e) };
  }
}

export async function pauseSubscriptionAction(): Promise<Result> {
  const ctx = await ctxFor();
  if (!ctx.ok) return ctx;
  const { data: bar } = await ctx.supabase
    .from("bars")
    .select("mp_preapproval_id")
    .eq("id", ctx.barId)
    .maybeSingle();
  if (!bar?.mp_preapproval_id) return { ok: false, error: "No tenés suscripción activa." };
  try {
    await pausePreapproval(bar.mp_preapproval_id);
    const admin = createAdminClient();
    await admin.from("bars").update({ plan_status: "paused" }).eq("id", ctx.barId);
    revalidatePath("/suscripcion");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: humanizeMpError(e) };
  }
}

export async function resumeSubscriptionAction(): Promise<Result> {
  const ctx = await ctxFor();
  if (!ctx.ok) return ctx;
  const { data: bar } = await ctx.supabase
    .from("bars")
    .select("mp_preapproval_id")
    .eq("id", ctx.barId)
    .maybeSingle();
  if (!bar?.mp_preapproval_id) return { ok: false, error: "No tenés suscripción activa." };
  try {
    await resumePreapproval(bar.mp_preapproval_id);
    const admin = createAdminClient();
    await admin.from("bars").update({ plan_status: "active" }).eq("id", ctx.barId);
    revalidatePath("/suscripcion");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: humanizeMpError(e) };
  }
}

// Reconciliación manual: busca todas las suscripciones del bar en MP, toma la
// más reciente autorizada (si la hay) como current, y refresca las invoices
// asociadas. Sirve cuando el webhook se perdió o el bar quedó con un
// mp_preapproval_id de un intento rechazado.
export async function refreshSubscriptionAction(): Promise<
  Result<{ status: string; invoicesUpdated: number }>
> {
  const ctx = await ctxFor();
  if (!ctx.ok) return ctx;

  let preapprovals;
  try {
    preapprovals = await searchPreapprovalsByExternalRef(ctx.barId);
  } catch (e) {
    return { ok: false, error: humanizeMpError(e) };
  }

  if (preapprovals.length === 0) {
    return {
      ok: false,
      error: "No encontramos ninguna suscripción tuya en MercadoPago para este bar.",
    };
  }

  // Ordenar por date_created descendente (más reciente primero).
  const sorted = [...preapprovals].sort(
    (a, b) => new Date(b.date_created).getTime() - new Date(a.date_created).getTime()
  );

  // Preferimos la más reciente autorizada; si no hay, la más reciente.
  const target = sorted.find((p) => p.status === "authorized") ?? sorted[0];

  const newPlanStatus =
    target.status === "authorized"
      ? "active"
      : target.status === "paused"
      ? "paused"
      : target.status === "cancelled"
      ? "cancelled"
      : "trialing"; // pending u otro

  const admin = createAdminClient();
  await admin
    .from("bars")
    .update({
      plan_status: newPlanStatus,
      mp_preapproval_id: target.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ctx.barId);

  // Refrescar invoices del preapproval target. Si la API de search falla, no
  // es fatal — el plan_status ya quedó bien.
  let invoicesUpdated = 0;
  try {
    const payments = await searchAuthorizedPaymentsByPreapproval(target.id);
    for (const ap of payments) {
      const isPaid = ap.payment_state === "approved";
      const isFailed = ap.payment_state === "rejected";

      const periodStart = ap.date_created.slice(0, 10);
      const periodEndDate = new Date(ap.date_created);
      periodEndDate.setMonth(periodEndDate.getMonth() + 1);
      const periodEnd = periodEndDate.toISOString().slice(0, 10);

      const { data: existing } = await admin
        .from("invoices")
        .select("id")
        .eq("external_id", String(ap.id))
        .maybeSingle();

      const invoiceRow = {
        bar_id: ctx.barId,
        external_id: String(ap.id),
        mp_payment_id: ap.payment_id ? String(ap.payment_id) : null,
        amount: ap.transaction_amount,
        period_start: periodStart,
        period_end: periodEnd,
        status: (isPaid ? "paid" : isFailed ? "failed" : "pending") as
          | "paid"
          | "failed"
          | "pending",
        paid_at: isPaid ? new Date(ap.last_modified).toISOString() : null,
      };

      if (existing) {
        await admin.from("invoices").update(invoiceRow).eq("id", existing.id);
      } else {
        await admin.from("invoices").insert(invoiceRow);
      }
      invoicesUpdated++;
    }
  } catch (e) {
    console.error("[refresh] error syncing invoices:", e);
  }

  revalidatePath("/suscripcion");
  return { ok: true, data: { status: target.status, invoicesUpdated } };
}

// Traduce errores comunes de MP a mensajes accionables en español.
function humanizeMpError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  const lower = raw.toLowerCase();
  if (lower.includes("payer_email") || lower.includes("collector_id")) {
    return "El email del pagador no coincide con la cuenta de MercadoPago del checkout.";
  }
  if (lower.includes("rejected") || lower.includes("cc_rejected")) {
    return "MercadoPago rechazó la tarjeta. Probá con otra o revisá saldo y datos.";
  }
  if (lower.includes("not found") || lower.includes("404")) {
    return "La suscripción no existe en MercadoPago.";
  }
  if (lower.includes("unauthorized") || lower.includes("401") || lower.includes("403")) {
    return "El access token de MercadoPago no es válido.";
  }
  return raw;
}
