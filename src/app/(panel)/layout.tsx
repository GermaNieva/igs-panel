import { redirect } from "next/navigation";
import IGSShell from "@/components/shell/IGSShell";
import { getCurrentUser, getCurrentProfile } from "@/lib/supabase/auth";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/ingresar");

  const profile = await getCurrentProfile();

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
