"use server";
import { revalidatePath, updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { dashboardTagForBar } from "@/lib/cache";

type Result = { ok: true } | { ok: false; error: string };

type Ctx =
  | { ok: false; error: string }
  | {
      ok: true;
      barId: string;
      profileId: string;
      role: string;
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
  if (!["owner", "manager", "waiter", "super_admin"].includes(profile.role)) {
    return { ok: false, error: "Esta vista es para mozos, encargados o dueños." };
  }
  return { ok: true, barId: profile.bar_id, profileId: user.id, role: profile.role, supabase };
}

// ============== Confirmar y mandar a cocina ==============
export async function confirmOrderAction(orderId: string): Promise<Result> {
  const ctx = await ctxFor();
  if (!ctx.ok) return ctx;

  const now = new Date().toISOString();

  const { data: order, error: getErr } = await ctx.supabase
    .from("orders")
    .select("id, table_id, status")
    .eq("id", orderId)
    .eq("bar_id", ctx.barId)
    .maybeSingle();
  if (getErr || !order) return { ok: false, error: getErr?.message ?? "Pedido no encontrado." };

  const { error: updErr } = await ctx.supabase
    .from("orders")
    .update({
      status: "in_kitchen",
      waiter_id: ctx.profileId,
      sent_to_kitchen_at: now,
    })
    .eq("id", orderId)
    .eq("bar_id", ctx.barId);
  if (updErr) return { ok: false, error: updErr.message };

  // Marcar mesa como ocupada y limpiar called_at
  if (order.table_id) {
    await ctx.supabase
      .from("tables")
      .update({ status: "occupied", called_at: null })
      .eq("id", order.table_id)
      .eq("bar_id", ctx.barId);
  }

  revalidatePath("/mozo");
  revalidatePath("/cocina");
  revalidatePath("/dashboard");
  revalidatePath("/mesas");
  updateTag(dashboardTagForBar(ctx.barId));
  return { ok: true };
}

// ============== Marcar como atendida (sin mandar a cocina, ej. consulta) ==============
export async function dismissCallAction(orderId: string): Promise<Result> {
  const ctx = await ctxFor();
  if (!ctx.ok) return ctx;

  const { data: order } = await ctx.supabase
    .from("orders")
    .select("id, table_id")
    .eq("id", orderId)
    .eq("bar_id", ctx.barId)
    .maybeSingle();
  if (!order) return { ok: false, error: "Pedido no encontrado." };

  const { error: updErr } = await ctx.supabase
    .from("orders")
    .update({ status: "cancelled" })
    .eq("id", orderId)
    .eq("bar_id", ctx.barId);
  if (updErr) return { ok: false, error: updErr.message };

  if (order.table_id) {
    await ctx.supabase
      .from("tables")
      .update({ status: "free", called_at: null })
      .eq("id", order.table_id)
      .eq("bar_id", ctx.barId);
  }

  revalidatePath("/mozo");
  revalidatePath("/dashboard");
  revalidatePath("/mesas");
  updateTag(dashboardTagForBar(ctx.barId));
  return { ok: true };
}

// ============== Marcar pedido como servido ==============
export async function markServedAction(orderId: string): Promise<Result> {
  const ctx = await ctxFor();
  if (!ctx.ok) return ctx;

  const { error } = await ctx.supabase
    .from("orders")
    .update({ status: "served" })
    .eq("id", orderId)
    .eq("bar_id", ctx.barId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/mozo");
  revalidatePath("/cocina");
  revalidatePath("/dashboard");
  updateTag(dashboardTagForBar(ctx.barId));
  return { ok: true };
}

// ============== Marcar cuenta pagada ==============
export async function markPaidAction(orderId: string): Promise<Result> {
  const ctx = await ctxFor();
  if (!ctx.ok) return ctx;

  const { data: order } = await ctx.supabase
    .from("orders")
    .select("id, table_id")
    .eq("id", orderId)
    .eq("bar_id", ctx.barId)
    .maybeSingle();
  if (!order) return { ok: false, error: "Pedido no encontrado." };

  const now = new Date().toISOString();
  const { error: updErr } = await ctx.supabase
    .from("orders")
    .update({ status: "paid", paid_at: now })
    .eq("id", orderId)
    .eq("bar_id", ctx.barId);
  if (updErr) return { ok: false, error: updErr.message };

  // Liberar la mesa
  if (order.table_id) {
    await ctx.supabase
      .from("tables")
      .update({ status: "free", called_at: null })
      .eq("id", order.table_id)
      .eq("bar_id", ctx.barId);
  }

  revalidatePath("/mozo");
  revalidatePath("/dashboard");
  revalidatePath("/mesas");
  updateTag(dashboardTagForBar(ctx.barId));
  return { ok: true };
}

// ============== Agregar nota de cocina al pedido ==============
export async function updateOrderNotesAction(orderId: string, notes: string): Promise<Result> {
  const ctx = await ctxFor();
  if (!ctx.ok) return ctx;
  const { error } = await ctx.supabase
    .from("orders")
    .update({ notes: notes.trim() || null })
    .eq("id", orderId)
    .eq("bar_id", ctx.barId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/mozo");
  return { ok: true };
}

// ============== Obtener detalle del pedido ==============
export async function getOrderDetailAction(orderId: string) {
  const ctx = await ctxFor();
  if (!ctx.ok) return { ok: false as const, error: ctx.error };
  const { data, error } = await ctx.supabase
    .from("order_items")
    .select("id, name_snapshot, unit_price, qty, notes, station")
    .eq("order_id", orderId)
    .order("created_at");
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, items: data ?? [] };
}
