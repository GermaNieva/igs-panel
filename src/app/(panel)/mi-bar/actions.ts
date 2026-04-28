"use server";
import { revalidatePath, updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
