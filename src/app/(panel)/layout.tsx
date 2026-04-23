import { redirect } from "next/navigation";
import IGSShell from "@/components/shell/IGSShell";
import { createClient } from "@/lib/supabase/server";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/ingresar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, bar_id, bars(name)")
    .eq("id", user.id)
    .maybeSingle();

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
