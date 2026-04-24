import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pickDestination } from "../callback/route";

// Recibe los tokens del flujo implícito de Supabase (que el navegador
// extrae del fragment #access_token=...) y los setea como sesión SSR.
// Devuelve la URL destino — el cliente navega ahí (con las cookies ya
// aplicadas a la response).

export async function POST(request: Request) {
  let body: { access_token?: string; refresh_token?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { access_token, refresh_token } = body;
  if (!access_token || !refresh_token) {
    return NextResponse.json({ error: "Faltan tokens" }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const destination = await pickDestination();
  return NextResponse.json({ destination });
}
