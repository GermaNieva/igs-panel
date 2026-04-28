import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getCurrentProfile } from "@/lib/supabase/auth";
import EquipoClient, { type StaffMember } from "./EquipoClient";

export default async function EquipoPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/ingresar");

  const profile = await getCurrentProfile();
  if (!profile?.bar_id) {
    return <div style={{ padding: 32 }}>Tu cuenta no tiene un bar asociado.</div>;
  }

  const supabase = await createClient();
  const { data: members } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active, last_seen_at")
    .eq("bar_id", profile.bar_id);

  // Para sacar el email de cada miembro necesitamos el admin client (auth.users)
  const admin = createAdminClient();
  const ids = (members ?? []).map((m) => m.id);
  let emails: Record<string, string> = {};
  if (ids.length) {
    const { data: usersList } = await admin.auth.admin.listUsers({ perPage: 1000 });
    emails = Object.fromEntries(
      (usersList?.users ?? [])
        .filter((u) => ids.includes(u.id))
        .map((u) => [u.id, u.email ?? ""])
    );
  }

  const staff: StaffMember[] = (members ?? []).map((m) => ({
    id: m.id,
    name: m.full_name ?? "Sin nombre",
    email: emails[m.id] ?? "",
    role: (m.role ?? "owner") as StaffMember["role"],
    active: m.is_active ?? true,
    last_seen: m.last_seen_at,
  }));

  return (
    <EquipoClient
      currentUserId={user.id}
      currentUserRole={profile.role as "owner" | "manager" | "super_admin"}
      staff={staff}
    />
  );
}
