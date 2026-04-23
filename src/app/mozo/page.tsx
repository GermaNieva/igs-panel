import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MozoClient, { type ActiveOrder } from "./MozoClient";

export default async function MozoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("bar_id, role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.bar_id) {
    return <div style={{ padding: 32 }}>Tu cuenta no tiene un bar asociado.</div>;
  }
  if (!["owner", "manager", "waiter", "super_admin"].includes(profile.role)) {
    redirect("/dashboard");
  }

  const { data: orders } = await supabase
    .from("orders")
    .select("id, status, total, called_at, sent_to_kitchen_at, ready_at, table_id, tables(number, alias)")
    .eq("bar_id", profile.bar_id)
    .in("status", ["calling_waiter", "in_kitchen", "ready", "served"])
    .order("called_at", { ascending: true });

  const activeOrders: ActiveOrder[] = (orders ?? []).map((o) => {
    const t = o.tables as { number: number; alias: string | null } | { number: number; alias: string | null }[] | null;
    const table = Array.isArray(t) ? t[0] : t;
    return {
      id: o.id,
      status: o.status as ActiveOrder["status"],
      total: o.total ?? 0,
      called_at: o.called_at,
      sent_to_kitchen_at: o.sent_to_kitchen_at,
      ready_at: o.ready_at,
      table_number: table?.number ?? null,
      table_alias: table?.alias ?? null,
    };
  });

  const ownerName = (profile.full_name ?? user.email?.split("@")[0] ?? "Mozo").trim();

  return (
    <MozoClient
      barId={profile.bar_id}
      waiterName={ownerName}
      initialOrders={activeOrders}
    />
  );
}
