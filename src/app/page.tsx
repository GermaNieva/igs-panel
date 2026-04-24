import { redirect } from "next/navigation";

// Si Supabase mandó al root con ?code (ej. cuando strip-ea el path del redirect_to),
// reenviamos al callback. Sino, redirige a /ingresar (proxy.ts ya manda
// usuarios logueados a /dashboard).
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; error_description?: string; error?: string }>;
}) {
  const sp = await searchParams;
  if (sp.code) {
    redirect(`/auth/callback?code=${encodeURIComponent(sp.code)}`);
  }
  if (sp.error_description || sp.error) {
    const msg = sp.error_description || sp.error || "auth";
    redirect(`/ingresar?error=${encodeURIComponent(msg)}`);
  }
  redirect("/ingresar");
}
