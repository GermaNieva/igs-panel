import { redirect } from "next/navigation";

export default function HomePage() {
  // TODO: cuando esté Supabase, redirigir según sesión (dashboard si logueado, ingresar si no).
  redirect("/ingresar");
}
