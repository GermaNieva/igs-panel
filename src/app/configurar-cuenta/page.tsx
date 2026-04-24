import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SetPasswordForm from "./SetPasswordForm";

export default async function ConfigurarCuentaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, bars(name)")
    .eq("id", user.id)
    .maybeSingle();

  // @ts-expect-error — supabase join typing
  const barName = (profile?.bars?.name ?? null) as string | null;
  const fullName = profile?.full_name ?? user.email?.split("@")[0] ?? "";
  const role = (profile?.role ?? "owner") as "owner" | "manager" | "waiter" | "kitchen" | "super_admin";

  return (
    <SetPasswordForm
      email={user.email ?? ""}
      fullName={fullName}
      barName={barName}
      role={role}
    />
  );
}
