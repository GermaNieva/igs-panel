"use server";
import { revalidatePath, updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cancelPreapproval } from "@/lib/mercadopago";

export type BarUpdate = {
  name: string;
  tagline: string | null;
  welcome_msg: string | null;
  address: string | null;
  city: string | null;
  socials: {
    instagram: string;
    facebook: string;
    whatsapp: string;
    reservation_url: string;
  };
};

export type SaveResult = { ok: true } | { ok: false; error: string };

export async function updateBarAction(input: BarUpdate): Promise<SaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No estás logueado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("bar_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.bar_id) return { ok: false, error: "Tu usuario no está asociado a un bar." };
  if (!["owner", "manager", "super_admin"].includes(profile.role)) {
    return { ok: false, error: "No tenés permisos para editar el bar." };
  }

  const name = input.name.trim();
  if (!name) return { ok: false, error: "El nombre del bar es obligatorio." };

  const { error } = await supabase
    .from("bars")
    .update({
      name,
      tagline: input.tagline?.trim() || null,
      welcome_msg: input.welcome_msg?.trim() || null,
      address: input.address?.trim() || null,
      city: input.city?.trim() || null,
      socials: {
        instagram: input.socials.instagram.trim(),
        facebook: input.socials.facebook.trim(),
        whatsapp: input.socials.whatsapp.trim(),
        reservation_url: input.socials.reservation_url.trim(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", profile.bar_id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/mi-bar");
  revalidatePath("/", "layout");
  // El profile cacheado incluye bars(name); invalidar todos para reflejar el cambio.
  updateTag("profile");
  return { ok: true };
}

// Eliminación definitiva del bar y la cuenta del dueño.
// Requiere que el dueño escriba el nombre exacto del bar para confirmar
// (anti accidentes). Cancela la preapproval de MP si existe, borra el bar
// (cascade borra carta, mesas, pedidos, invoices, profiles del staff) y
// borra al user de auth (queda imposibilitado de loguearse).
export async function deleteAccountAction(input: {
  confirmName: string;
}): Promise<SaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No estás logueado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("bar_id, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.bar_id) return { ok: false, error: "Tu usuario no está asociado a un bar." };
  if (profile.role !== "owner" && profile.role !== "super_admin") {
    return { ok: false, error: "Solo el dueño puede eliminar la cuenta del bar." };
  }

  const admin = createAdminClient();

  const { data: bar } = await admin
    .from("bars")
    .select("id, name, mp_preapproval_id")
    .eq("id", profile.bar_id)
    .maybeSingle();
  if (!bar) return { ok: false, error: "No se encontró el bar." };

  // Confirmación: el dueño tiene que escribir el nombre exacto.
  if (input.confirmName.trim() !== bar.name.trim()) {
    return {
      ok: false,
      error: `Para confirmar tenés que escribir el nombre exacto del bar: "${bar.name}".`,
    };
  }

  // 1. Cancelar preapproval en MP si hay (best-effort: si MP falla seguimos).
  if (bar.mp_preapproval_id) {
    try {
      await cancelPreapproval(bar.mp_preapproval_id);
    } catch (e) {
      console.error("[delete-account] mp cancel failed:", e);
    }
  }

  // 2. Borrar el bar (cascade borra carta, mesas, pedidos, invoices, profiles
  //    del staff vinculados a ese bar gracias a `on delete cascade`).
  const { error: barErr } = await admin.from("bars").delete().eq("id", bar.id);
  if (barErr) return { ok: false, error: `No se pudo borrar el bar: ${barErr.message}` };

  // 3. Borrar al user de auth.users (cascade borra el profile del dueño).
  const { error: userErr } = await admin.auth.admin.deleteUser(user.id);
  if (userErr) {
    console.error("[delete-account] auth deleteUser failed:", userErr);
    // No es crítico: el bar ya está borrado y los datos del user quedan
    // huérfanos en auth pero sin acceso a nada.
  }

  return { ok: true };
}
