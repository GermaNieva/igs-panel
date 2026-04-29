"use server";
import { revalidatePath, updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Result<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

type Ctx =
  | { ok: false; error: string }
  | {
      ok: true;
      barId: string;
      userId: string;
      role: string;
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
    return { ok: false, error: "Solo el dueño puede completar el onboarding." };
  }
  return { ok: true, barId: profile.bar_id, userId: user.id, role: profile.role };
}

// Step 1 — datos básicos del bar.
export async function saveBarInfoAction(input: {
  name: string;
  tagline: string | null;
  welcome_msg: string | null;
  address: string | null;
  city: string | null;
}): Promise<Result> {
  const ctx = await ctxFor();
  if (!ctx.ok) return ctx;

  const name = input.name.trim();
  if (!name) return { ok: false, error: "El nombre del bar es obligatorio." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("bars")
    .update({
      name,
      tagline: input.tagline?.trim() || null,
      welcome_msg: input.welcome_msg?.trim() || null,
      address: input.address?.trim() || null,
      city: input.city?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ctx.barId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Step 2 — primera categoría + platos iniciales.
export async function saveFirstCategoryAction(input: {
  categoryName: string;
  items: { name: string; price: number; description: string; station: string }[];
}): Promise<Result<{ categoryId: string }>> {
  const ctx = await ctxFor();
  if (!ctx.ok) return ctx;

  const catName = input.categoryName.trim();
  if (!catName) return { ok: false, error: "El nombre de la categoría es obligatorio." };

  const validItems = input.items
    .map((i) => ({
      name: i.name.trim(),
      price: Math.max(0, Math.round(i.price)),
      description: i.description.trim(),
      station: i.station,
    }))
    .filter((i) => i.name.length > 0);

  if (validItems.length === 0) {
    return { ok: false, error: "Agregá al menos un plato." };
  }

  const admin = createAdminClient();

  const { data: cat, error: catErr } = await admin
    .from("categories")
    .insert({ bar_id: ctx.barId, name: catName, sort: 0 })
    .select("id")
    .single();
  if (catErr || !cat) return { ok: false, error: catErr?.message ?? "No se pudo crear la categoría." };

  const itemRows = validItems.map((it, idx) => ({
    bar_id: ctx.barId,
    category_id: cat.id,
    name: it.name,
    description: it.description || null,
    price: it.price,
    station: it.station,
    sort: idx,
  }));
  const { error: itemsErr } = await admin.from("menu_items").insert(itemRows);
  if (itemsErr) return { ok: false, error: itemsErr.message };

  return { ok: true, data: { categoryId: cat.id } };
}

// Step 3 — zona inicial + mesas.
export async function saveInitialTablesAction(input: {
  zoneName: string;
  tableCount: number;
  seatsPerTable: number;
}): Promise<Result<{ created: number }>> {
  const ctx = await ctxFor();
  if (!ctx.ok) return ctx;

  const zoneName = input.zoneName.trim() || "Salón principal";
  const tableCount = Math.max(1, Math.min(50, Math.round(input.tableCount)));
  const seats = Math.max(1, Math.min(20, Math.round(input.seatsPerTable)));

  const admin = createAdminClient();

  const { data: zone, error: zoneErr } = await admin
    .from("zones")
    .insert({ bar_id: ctx.barId, name: zoneName, sort: 0 })
    .select("id")
    .single();
  if (zoneErr || !zone) return { ok: false, error: zoneErr?.message ?? "No se pudo crear la zona." };

  // Encontrar el siguiente número de mesa libre (por si ya hay mesas previas)
  const { data: existing } = await admin
    .from("tables")
    .select("number")
    .eq("bar_id", ctx.barId);
  const taken = new Set((existing ?? []).map((t) => t.number));

  const tableRows = [];
  let next = 1;
  let created = 0;
  while (created < tableCount) {
    if (!taken.has(next)) {
      tableRows.push({ bar_id: ctx.barId, zone_id: zone.id, number: next, seats });
      created++;
    }
    next++;
    if (next > 200) break; // sanity
  }
  if (tableRows.length === 0) return { ok: true, data: { created: 0 } };

  const { error: tablesErr } = await admin.from("tables").insert(tableRows);
  if (tablesErr) return { ok: false, error: tablesErr.message };

  return { ok: true, data: { created } };
}

// Step 4 — invitar al primer staff. Versión simplificada del flow de equipo.
export async function inviteFirstStaffAction(input: {
  email: string;
  full_name: string;
  role: "manager" | "waiter" | "kitchen";
}): Promise<Result> {
  const ctx = await ctxFor();
  if (!ctx.ok) return ctx;

  const email = input.email.trim().toLowerCase();
  const full_name = input.full_name.trim();
  if (!email || !email.includes("@")) return { ok: false, error: "Email inválido." };
  if (!full_name) return { ok: false, error: "Falta el nombre." };

  const admin = createAdminClient();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const redirectTo = `${baseUrl}/auth/callback`;

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { bar_id: ctx.barId, role: input.role, full_name },
    redirectTo,
  });

  if (error) {
    if (error.message.toLowerCase().includes("already") || error.message.toLowerCase().includes("registered")) {
      return { ok: false, error: "Ese email ya está registrado." };
    }
    return { ok: false, error: error.message };
  }

  // Garantizar profile (idéntico al flow de equipo)
  const newUserId = data?.user?.id;
  if (newUserId) {
    await admin
      .from("profiles")
      .upsert(
        { id: newUserId, bar_id: ctx.barId, role: input.role, full_name, is_active: true },
        { onConflict: "id" }
      );
  }

  return { ok: true };
}

// Step final — marcar el onboarding como completo.
export async function completeOnboardingAction(): Promise<Result> {
  const ctx = await ctxFor();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();
  const { error } = await admin
    .from("bars")
    .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
    .eq("id", ctx.barId);
  if (error) return { ok: false, error: error.message };

  // Invalidamos el cache del profile (incluye onboarding_completed) para todos
  // los users del bar.
  updateTag("profile");
  revalidatePath("/", "layout");
  return { ok: true };
}
