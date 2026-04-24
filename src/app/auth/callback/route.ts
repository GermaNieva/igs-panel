import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Maneja el callback de Supabase Auth: invitaciones, recuperación de contraseña
// y eventualmente OAuth (Google). Intercambia el `code` por una sesión real
// y luego decide a dónde redirigir según rol y estado de la cuenta.

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const errorParam = searchParams.get("error_description") ?? searchParams.get("error");

  if (errorParam) {
    return NextResponse.redirect(
      `${origin}/ingresar?error=${encodeURIComponent(errorParam)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/ingresar?error=falta_codigo`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      `${origin}/ingresar?error=${encodeURIComponent(error.message)}`
    );
  }

  // Decidir destino según el rol y si tiene contraseña configurada
  const dest = await pickDestination();
  return NextResponse.redirect(`${origin}${dest}`);
}

export async function pickDestination(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "/ingresar";

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, password_set")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return "/dashboard";

  // Si el usuario nunca configuró su contraseña (recién aceptó invitación),
  // mandarlo a configurar antes de cualquier panel.
  if (!profile.password_set) return "/configurar-cuenta";

  // Mandarlo al panel correcto según rol
  if (profile.role === "kitchen") return "/cocina";
  if (profile.role === "waiter") return "/mozo";
  return "/dashboard";
}
