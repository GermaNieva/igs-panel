"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  cancelPreapproval,
  pausePreapproval,
  resumePreapproval,
  getCheckoutUrlForPlan,
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
