"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type Role = "owner" | "manager" | "waiter" | "kitchen";

type Result = { ok: true } | { ok: false; error: string };

type Ctx =
  | { ok: false; error: string }
  | {
      ok: true;
      barId: string;
      supabase: Awaited<ReturnType<typeof createClient>>;
      currentUserId: string;
      currentRole: string;
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
  if (!["owner", "manager", "super_admin"].includes(profile.role)) {
    return { ok: false, error: "No tenés permisos para gestionar el equipo." };
  }
  return {
    ok: true,
    barId: profile.bar_id,
    supabase,
    currentUserId: user.id,
    currentRole: profile.role,
  };
}

// ============== Invitar staff ==============
export async function inviteStaffAction(input: {
  email: string;
  full_name: string;
  role: Role;
}): Promise<Result> {
  const ctx = await ctxFor();
  if (!ctx.ok) return ctx;

  const email = input.email.trim().toLowerCase();
  const full_name = input.full_name.trim();
  if (!email || !email.includes("@")) return { ok: false, error: "Email inválido." };
  if (!full_name) return { ok: false, error: "Falta el nombre." };

  // Solo owner puede crear otros owners; manager solo invita waiter/kitchen
  if (input.role === "owner" && ctx.currentRole !== "owner" && ctx.currentRole !== "super_admin") {
    return { ok: false, error: "Solo el dueño puede invitar a otro dueño." };
  }

  const admin = createAdminClient();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const redirectTo = `${baseUrl}/auth/callback?next=/configurar-cuenta`;
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: {
      bar_id: ctx.barId,
      role: input.role,
      full_name,
    },
    redirectTo,
  });

  if (error) {
    if (error.message.toLowerCase().includes("already") || error.message.toLowerCase().includes("registered")) {
      return { ok: false, error: "Ese email ya está registrado en otra cuenta." };
    }
    return { ok: false, error: error.message };
  }

  // El trigger handle_new_user() crea el profile cuando el usuario acepta la invitación.
  // Pero algunas instancias crean la fila en auth.users al toque (con email_confirmed_at null).
  // Si el profile se creó con bar_id NULL por race, lo arreglamos:
  const newUserId = data?.user?.id;
  if (newUserId) {
    await admin
      .from("profiles")
      .upsert(
        { id: newUserId, bar_id: ctx.barId, role: input.role, full_name, is_active: true },
        { onConflict: "id" }
      );
  }

  revalidatePath("/equipo");
  return { ok: true };
}

// ============== Cambiar rol ==============
export async function updateStaffRoleAction(profileId: string, role: Role): Promise<Result> {
  const ctx = await ctxFor();
  if (!ctx.ok) return ctx;
  if (profileId === ctx.currentUserId && role !== "owner" && ctx.currentRole === "owner") {
    return { ok: false, error: "No te podés sacar el rol de dueño a vos mismo." };
  }
  if (role === "owner" && ctx.currentRole !== "owner" && ctx.currentRole !== "super_admin") {
    return { ok: false, error: "Solo el dueño puede asignar rol de dueño." };
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ role })
    .eq("id", profileId)
    .eq("bar_id", ctx.barId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/equipo");
  return { ok: true };
}

// ============== Activar/desactivar ==============
export async function toggleStaffActiveAction(profileId: string, active: boolean): Promise<Result> {
  const ctx = await ctxFor();
  if (!ctx.ok) return ctx;
  if (profileId === ctx.currentUserId && !active) {
    return { ok: false, error: "No te podés desactivar a vos mismo." };
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ is_active: active })
    .eq("id", profileId)
    .eq("bar_id", ctx.barId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/equipo");
  return { ok: true };
}

// ============== Eliminar persona ==============
export async function removeStaffAction(profileId: string): Promise<Result> {
  const ctx = await ctxFor();
  if (!ctx.ok) return ctx;
  if (profileId === ctx.currentUserId) {
    return { ok: false, error: "No te podés eliminar a vos mismo." };
  }
  const admin = createAdminClient();
  // Borramos el usuario de auth (cascada borra el profile).
  const { error } = await admin.auth.admin.deleteUser(profileId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/equipo");
  return { ok: true };
}
