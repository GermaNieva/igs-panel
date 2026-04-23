"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

type Ctx =
  | { ok: false; error: string }
  | { ok: true; barId: string; supabase: Awaited<ReturnType<typeof createClient>> };

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
  if (!["owner", "manager", "kitchen", "super_admin"].includes(profile.role)) {
    return { ok: false, error: "Esta vista es para cocina, encargados o dueños." };
  }
  return { ok: true, barId: profile.bar_id, supabase };
}

// Marcar / desmarcar un ítem como listo. Si todos los ítems están listos, marca el pedido como "ready".
export async function toggleItemReadyAction(itemId: string, ready: boolean): Promise<Result> {
  const ctx = await ctxFor();
  if (!ctx.ok) return ctx;

  const now = new Date().toISOString();
  const { data: item, error: getErr } = await ctx.supabase
    .from("order_items")
    .select("id, order_id, orders!inner(bar_id)")
    .eq("id", itemId)
    .maybeSingle();
  if (getErr || !item) return { ok: false, error: getErr?.message ?? "Ítem no encontrado." };

  // chequeo de seguridad por bar
  const orders = item.orders as { bar_id: string } | { bar_id: string }[] | null;
  const orderBarId = Array.isArray(orders) ? orders[0]?.bar_id : orders?.bar_id;
  if (orderBarId !== ctx.barId) return { ok: false, error: "Ítem de otro bar." };

  const { error: updErr } = await ctx.supabase
    .from("order_items")
    .update({ ready_at: ready ? now : null })
    .eq("id", itemId);
  if (updErr) return { ok: false, error: updErr.message };

  // Si todos los ítems del pedido están listos, marcar el pedido como ready
  const { data: pendientes } = await ctx.supabase
    .from("order_items")
    .select("id")
    .eq("order_id", item.order_id)
    .is("ready_at", null);

  if ((pendientes ?? []).length === 0) {
    await ctx.supabase
      .from("orders")
      .update({ status: "ready", ready_at: now })
      .eq("id", item.order_id)
      .eq("bar_id", ctx.barId)
      .eq("status", "in_kitchen");
  } else if (ready === false) {
    // Si destildaste un ítem y antes el pedido estaba ready, volver a in_kitchen
    await ctx.supabase
      .from("orders")
      .update({ status: "in_kitchen", ready_at: null })
      .eq("id", item.order_id)
      .eq("bar_id", ctx.barId)
      .eq("status", "ready");
  }

  revalidatePath("/cocina");
  revalidatePath("/mozo");
  revalidatePath("/dashboard");
  return { ok: true };
}

// Marcar TODA la mesa como lista (atajo)
export async function markOrderReadyAction(orderId: string): Promise<Result> {
  const ctx = await ctxFor();
  if (!ctx.ok) return ctx;
  const now = new Date().toISOString();

  const { error: itemsErr } = await ctx.supabase
    .from("order_items")
    .update({ ready_at: now })
    .eq("order_id", orderId)
    .is("ready_at", null);
  if (itemsErr) return { ok: false, error: itemsErr.message };

  const { error: orderErr } = await ctx.supabase
    .from("orders")
    .update({ status: "ready", ready_at: now })
    .eq("id", orderId)
    .eq("bar_id", ctx.barId);
  if (orderErr) return { ok: false, error: orderErr.message };

  revalidatePath("/cocina");
  revalidatePath("/mozo");
  return { ok: true };
}
