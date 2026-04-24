import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Maneja el callback de Supabase Auth: invitaciones, recuperación de contraseña
// y eventualmente OAuth (Google).
//
// Acepta dos flujos:
// 1) PKCE: viene `?code=...` → intercambia por sesión.
// 2) Implicit: el cliente ya seteó la sesión vía hash (#access_token=...) y
//    nos llama acá para que decidamos destino. No hay code, hay sesión.

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const errorParam = searchParams.get("error_description") ?? searchParams.get("error");

  if (errorParam) {
    return NextResponse.redirect(
      `${origin}/ingresar?error=${encodeURIComponent(errorParam)}`
    );
  }

  // Si vino code, intercambiar por sesión. Sino, asumimos sesión ya seteada.
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        `${origin}/ingresar?error=${encodeURIComponent(error.message)}`
      );
    }
  }

  // Decidir destino según la sesión actual.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    // No hay sesión y no hay code — el usuario llegó al callback de gusto.
    return NextResponse.redirect(`${origin}/ingresar?error=sesion_invalida`);
  }

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

  // Si nunca configuró contraseña (recién aceptó invitación), ahí va primero.
  if (!profile.password_set) return "/configurar-cuenta";

  // Mandarlo al panel correcto según rol.
  if (profile.role === "kitchen") return "/cocina";
  if (profile.role === "waiter") return "/mozo";
  return "/dashboard";
}
