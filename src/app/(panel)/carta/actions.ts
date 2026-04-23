"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { StationId } from "@/lib/tokens";

type Result<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

type Ctx =
  | { ok: false; error: string }
  | { ok: true; barId: string; supabase: Awaited<ReturnType<typeof createClient>> };

async function getBarId(): Promise<Ctx> {
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
    return { ok: false, error: "No tenés permisos para editar la carta." };
  }
  return { ok: true, barId: profile.bar_id, supabase };
}

// ============== Categorías ==============
export async function createCategoryAction(name: string): Promise<Result<{ id: string }>> {
  const ctx = await getBarId();
  if (!ctx.ok) return ctx;
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "El nombre es obligatorio." };

  const { data: maxRow } = await ctx.supabase
    .from("categories")
    .select("sort")
    .eq("bar_id", ctx.barId)
    .order("sort", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort = (maxRow?.sort ?? -1) + 1;

  const { data, error } = await ctx.supabase
    .from("categories")
    .insert({ bar_id: ctx.barId, name: trimmed, sort })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/carta");
  return { ok: true, data: { id: data.id } };
}

export async function renameCategoryAction(id: string, name: string): Promise<Result> {
  const ctx = await getBarId();
  if (!ctx.ok) return ctx;
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "El nombre es obligatorio." };
  const { error } = await ctx.supabase
    .from("categories")
    .update({ name: trimmed })
    .eq("id", id)
    .eq("bar_id", ctx.barId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/carta");
  return { ok: true };
}

export async function deleteCategoryAction(id: string): Promise<Result> {
  const ctx = await getBarId();
  if (!ctx.ok) return ctx;
  const { error } = await ctx.supabase
    .from("categories")
    .delete()
    .eq("id", id)
    .eq("bar_id", ctx.barId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/carta");
  return { ok: true };
}

// ============== Platos ==============
type CreateItemInput = {
  category_id: string;
  name: string;
  description?: string;
  price: number;
  station: StationId;
};

export async function createMenuItemAction(input: CreateItemInput): Promise<Result<{ id: string }>> {
  const ctx = await getBarId();
  if (!ctx.ok) return ctx;
  const name = input.name.trim();
  if (!name) return { ok: false, error: "El nombre es obligatorio." };

  const { data: maxRow } = await ctx.supabase
    .from("menu_items")
    .select("sort")
    .eq("bar_id", ctx.barId)
    .eq("category_id", input.category_id)
    .order("sort", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort = (maxRow?.sort ?? -1) + 1;

  const { data, error } = await ctx.supabase
    .from("menu_items")
    .insert({
      bar_id: ctx.barId,
      category_id: input.category_id,
      name,
      description: input.description?.trim() || null,
      price: Math.max(0, Math.round(input.price || 0)),
      station: input.station,
      sort,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/carta");
  return { ok: true, data: { id: data.id } };
}

type UpdateItemInput = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  station: StationId;
};

export async function updateMenuItemAction(input: UpdateItemInput): Promise<Result> {
  const ctx = await getBarId();
  if (!ctx.ok) return ctx;
  const name = input.name.trim();
  if (!name) return { ok: false, error: "El nombre es obligatorio." };
  const { error } = await ctx.supabase
    .from("menu_items")
    .update({
      name,
      description: input.description?.trim() || null,
      price: Math.max(0, Math.round(input.price || 0)),
      station: input.station,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .eq("bar_id", ctx.barId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/carta");
  return { ok: true };
}

export async function toggleMenuItemActiveAction(id: string, active: boolean): Promise<Result> {
  const ctx = await getBarId();
  if (!ctx.ok) return ctx;
  const { error } = await ctx.supabase
    .from("menu_items")
    .update({ active })
    .eq("id", id)
    .eq("bar_id", ctx.barId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/carta");
  return { ok: true };
}

export async function deleteMenuItemAction(id: string): Promise<Result> {
  const ctx = await getBarId();
  if (!ctx.ok) return ctx;
  const { data: item } = await ctx.supabase
    .from("menu_items")
    .select("photo_url")
    .eq("id", id)
    .eq("bar_id", ctx.barId)
    .maybeSingle();
  // Borrar foto del storage si existe
  if (item?.photo_url) {
    const path = extractStoragePath(item.photo_url, "menu-photos");
    if (path) await ctx.supabase.storage.from("menu-photos").remove([path]);
  }
  const { error } = await ctx.supabase
    .from("menu_items")
    .delete()
    .eq("id", id)
    .eq("bar_id", ctx.barId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/carta");
  return { ok: true };
}

// ============== Fotos ==============
export async function uploadMenuItemPhotoAction(itemId: string, formData: FormData): Promise<Result<{ url: string }>> {
  const ctx = await getBarId();
  if (!ctx.ok) return ctx;
  const file = formData.get("photo") as File | null;
  if (!file || !file.size) return { ok: false, error: "No se recibió la foto." };
  if (file.size > 2 * 1024 * 1024) return { ok: false, error: "La foto pesa más de 2 MB." };

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${ctx.barId}/items/${itemId}-${Date.now()}.${ext}`;
  const { error: upErr } = await ctx.supabase.storage
    .from("menu-photos")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (upErr) return { ok: false, error: upErr.message };

  const { data: pub } = ctx.supabase.storage.from("menu-photos").getPublicUrl(path);
  const url = pub.publicUrl;

  // Si había foto previa, borrarla
  const { data: prev } = await ctx.supabase
    .from("menu_items")
    .select("photo_url")
    .eq("id", itemId)
    .maybeSingle();
  if (prev?.photo_url) {
    const oldPath = extractStoragePath(prev.photo_url, "menu-photos");
    if (oldPath && oldPath !== path) {
      await ctx.supabase.storage.from("menu-photos").remove([oldPath]);
    }
  }

  const { error: dbErr } = await ctx.supabase
    .from("menu_items")
    .update({ photo_url: url, updated_at: new Date().toISOString() })
    .eq("id", itemId)
    .eq("bar_id", ctx.barId);
  if (dbErr) return { ok: false, error: dbErr.message };

  revalidatePath("/carta");
  return { ok: true, data: { url } };
}

// ============== Seed para bar nuevo ==============
export async function seedDefaultCategoriesAction(): Promise<Result> {
  const ctx = await getBarId();
  if (!ctx.ok) return ctx;
  const { count } = await ctx.supabase
    .from("categories")
    .select("id", { count: "exact", head: true })
    .eq("bar_id", ctx.barId);
  if ((count ?? 0) > 0) return { ok: true };

  const defaults = [
    { name: "Entradas", sort: 0 },
    { name: "Principales", sort: 1 },
    { name: "Postres", sort: 2 },
    { name: "Bebidas", sort: 3 },
  ];
  const { error } = await ctx.supabase
    .from("categories")
    .insert(defaults.map((d) => ({ bar_id: ctx.barId, ...d })));
  if (error) return { ok: false, error: error.message };
  revalidatePath("/carta");
  return { ok: true };
}

// ============== utils ==============
function extractStoragePath(publicUrl: string, bucket: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return publicUrl.slice(idx + marker.length);
}
