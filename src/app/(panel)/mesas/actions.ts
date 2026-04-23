"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

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
  if (!["owner", "manager", "super_admin"].includes(profile.role)) {
    return { ok: false, error: "No tenés permisos para editar las mesas." };
  }
  return { ok: true, barId: profile.bar_id, supabase };
}

// ============ Zonas ============
export async function createZoneAction(name: string): Promise<Result<{ id: string }>> {
  const ctx = await ctxFor();
  if (!ctx.ok) return ctx;
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "El nombre es obligatorio." };

  const { data: maxRow } = await ctx.supabase
    .from("zones")
    .select("sort")
    .eq("bar_id", ctx.barId)
    .order("sort", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort = (maxRow?.sort ?? -1) + 1;

  const { data, error } = await ctx.supabase
    .from("zones")
    .insert({ bar_id: ctx.barId, name: trimmed, sort })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/mesas");
  return { ok: true, data: { id: data.id } };
}

export async function renameZoneAction(id: string, name: string): Promise<Result> {
  const ctx = await ctxFor();
  if (!ctx.ok) return ctx;
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "El nombre es obligatorio." };
  const { error } = await ctx.supabase
    .from("zones")
    .update({ name: trimmed })
    .eq("id", id)
    .eq("bar_id", ctx.barId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/mesas");
  return { ok: true };
}

export async function deleteZoneAction(id: string): Promise<Result> {
  const ctx = await ctxFor();
  if (!ctx.ok) return ctx;
  // Las mesas asociadas quedan con zone_id null (ON DELETE SET NULL)
  const { error } = await ctx.supabase
    .from("zones")
    .delete()
    .eq("id", id)
    .eq("bar_id", ctx.barId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/mesas");
  return { ok: true };
}

// ============ Mesas ============
export async function createTableAction(zoneId: string | null, seats = 4): Promise<Result<{ id: string; number: number }>> {
  const ctx = await ctxFor();
  if (!ctx.ok) return ctx;

  const { data: maxRow } = await ctx.supabase
    .from("tables")
    .select("number")
    .eq("bar_id", ctx.barId)
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const number = (maxRow?.number ?? 0) + 1;

  const { data, error } = await ctx.supabase
    .from("tables")
    .insert({ bar_id: ctx.barId, zone_id: zoneId, number, seats })
    .select("id, number")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/mesas");
  return { ok: true, data: { id: data.id, number: data.number } };
}

type UpdateTableInput = {
  id: string;
  alias: string | null;
  seats: number;
  zone_id: string | null;
};

export async function updateTableAction(input: UpdateTableInput): Promise<Result> {
  const ctx = await ctxFor();
  if (!ctx.ok) return ctx;
  const { error } = await ctx.supabase
    .from("tables")
    .update({
      alias: input.alias?.trim() || null,
      seats: Math.max(1, Math.round(input.seats || 1)),
      zone_id: input.zone_id,
    })
    .eq("id", input.id)
    .eq("bar_id", ctx.barId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/mesas");
  return { ok: true };
}

export async function deleteTableAction(id: string): Promise<Result> {
  const ctx = await ctxFor();
  if (!ctx.ok) return ctx;
  const { error } = await ctx.supabase
    .from("tables")
    .delete()
    .eq("id", id)
    .eq("bar_id", ctx.barId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/mesas");
  return { ok: true };
}

// ============ Seed ============
export async function seedFirstZoneAction(): Promise<Result> {
  const ctx = await ctxFor();
  if (!ctx.ok) return ctx;
  const { count } = await ctx.supabase
    .from("zones")
    .select("id", { count: "exact", head: true })
    .eq("bar_id", ctx.barId);
  if ((count ?? 0) > 0) return { ok: true };
  const { error } = await ctx.supabase
    .from("zones")
    .insert({ bar_id: ctx.barId, name: "Salón principal", sort: 0 });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/mesas");
  return { ok: true };
}
