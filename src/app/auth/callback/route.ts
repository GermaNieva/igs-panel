import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Maneja el callback de Supabase Auth: invitaciones, recuperación de contraseña
// y eventualmente OAuth (Google). Intercambia el `code` por una sesión real.

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
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

  // Validar que el "next" sea una ruta interna (no un redirect abierto)
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  return NextResponse.redirect(`${origin}${safeNext}`);
}
