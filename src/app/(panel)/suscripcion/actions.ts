"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createPreapproval,
  cancelPreapproval,
  pausePreapproval,
  resumePreapproval,
  PLAN_PRICE,
  PLAN_NAME,
} from "@/lib/mercadopago";

type Result<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

type Ctx =
  | { ok: false; error: string }
  | {
      ok: true;
      barId: string;
      barOwnerEmail: string;
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
  return {
    ok: true,
    barId: profile.bar_id,
    barOwnerEmail: user.email ?? "",
    supabase,
  };
}

export async function startSubscriptionAction(
  input?: { payerEmailOverride?: string } | FormData
): Promise<Result<{ init_point: string }>> {
  const ctx = await ctxFor();
  if (!ctx.ok) return ctx;

  if (!ctx.barOwnerEmail) {
    return { ok: false, error: "Tu cuenta no tiene email registrado." };
  }

  // Permitir que el dueño use un email de MP distinto al de su login del panel.
  // Causa #1 más común de "Algo salió mal" en el checkout: el email enviado en el
  // body no coincide con el de la cuenta de MP con la que se loguea el comprador.
  const rawOverride =
    input instanceof FormData
      ? (input.get("payerEmail") as string | null) ?? ""
      : input?.payerEmailOverride ?? "";
  const trimmedOverride = rawOverride.trim().toLowerCase();
  const payerEmail = trimmedOverride || ctx.barOwnerEmail;

  if (trimmedOverride && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedOverride)) {
    return { ok: false, error: "El email de MercadoPago no es válido." };
  }

  // Si ya hay una preapproval activa, no creamos otra
  const { data: bar } = await ctx.supabase
    .from("bars")
    .select("mp_preapproval_id, plan_status, name")
    .eq("id", ctx.barId)
    .maybeSingle();
  if (!bar) return { ok: false, error: "No se encontró el bar." };

  if (bar.mp_preapproval_id && bar.plan_status === "active") {
    return { ok: false, error: "Tu plan ya está activo." };
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  try {
    const pre = await createPreapproval({
      payer_email: payerEmail,
      reason: `${PLAN_NAME} — ${bar.name}`,
      amount: PLAN_PRICE,
      external_reference: ctx.barId,
      back_url: `${baseUrl}/suscripcion?mp=ok`,
      notification_url: `${baseUrl}/api/mp-webhook`,
    });

    // Guardar el ID en el bar para poder consultarlo después
    const admin = createAdminClient();
    await admin
      .from("bars")
      .update({
        mp_preapproval_id: pre.id,
      })
      .eq("id", ctx.barId);

    revalidatePath("/suscripcion");
    return { ok: true, data: { init_point: pre.init_point } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `No pudimos iniciar la suscripción: ${msg}` };
  }
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
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
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
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
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
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
