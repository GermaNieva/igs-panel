"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Result = { error: string } | undefined;

export async function setPasswordAction(formData: FormData): Promise<Result> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }
  if (password !== confirm) {
    return { error: "Las contraseñas no coinciden." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Tu sesión expiró. Pedí una nueva invitación." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  // Determinar a dónde mandar al usuario según su rol
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const dest =
    profile?.role === "kitchen"
      ? "/cocina"
      : profile?.role === "waiter"
      ? "/mozo"
      : "/dashboard";

  redirect(dest);
}
