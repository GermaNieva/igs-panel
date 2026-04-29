import { redirect } from "next/navigation";
import IGSShell from "@/components/shell/IGSShell";
import { getCurrentUser, getCurrentProfile } from "@/lib/supabase/auth";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/ingresar");

  const profile = await getCurrentProfile();

  // Si el dueño todavía no completó el wizard, lo redirigimos.
  // Solo redirigimos a owners (no a staff invitado, que no necesita configurar el bar).
  // @ts-expect-error — supabase join typing
  const onboardingCompleted: boolean = profile?.bars?.onboarding_completed ?? true;
  if (
    profile?.bar_id &&
    !onboardingCompleted &&
    (profile.role === "owner" || profile.role === "super_admin")
  ) {
    redirect("/onboarding");
  }

  const ownerName =
    profile?.full_name ||
    user.user_metadata?.full_name ||
    (user.email ? user.email.split("@")[0] : "Usuario");

  // @ts-expect-error — supabase join typing
  const barName = profile?.bars?.name ?? "Mi bar";

  return (
    <IGSShell bar={{ name: barName, owner: ownerName }}>
      {children}
    </IGSShell>
  );
}
