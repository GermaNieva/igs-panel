"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthResult = { error: string } | void;

export async function loginAction(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  if (!email || !password) return { error: "Faltan datos." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: traducirError(error.message) };
  }
  redirect(next);
}

export async function signupAction(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const barName = String(formData.get("bar_name") ?? "").trim();

  if (!email || !password || !barName) return { error: "Faltan datos." };
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        bar_name: barName,
        full_name: email.split("@")[0],
      },
    },
  });

  if (error) return { error: traducirError(error.message) };
  redirect("/dashboard");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/ingresar");
}

function traducirError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email o contraseña incorrectos.";
  if (m.includes("already registered") || m.includes("user already"))
    return "Ya existe una cuenta con ese email. Probá ingresar.";
  if (m.includes("email") && m.includes("confirm"))
    return "Revisá tu email para confirmar la cuenta.";
  if (m.includes("password")) return "Contraseña inválida. Mínimo 8 caracteres.";
  return msg;
}
