import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CocinaClient, { type KitchenOrder } from "./CocinaClient";

export default async function CocinaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("bar_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.bar_id) {
    return <div style={{ padding: 32 }}>Tu cuenta no tiene un bar asociado.</div>;
  }
  if (!["owner", "manager", "kitchen", "super_admin"].includes(profile.role)) {
    redirect("/dashboard");
  }

  const { data: orders } = await supabase
    .from("orders")
    .select(`
      id,
      status,
      sent_to_kitchen_at,
      ready_at,
      notes,
      table_id,
      tables(number, alias),
      order_items(id, name_snapshot, qty, notes, station, ready_at)
    `)
    .eq("bar_id", profile.bar_id)
    .in("status", ["in_kitchen", "ready"])
    .order("sent_to_kitchen_at", { ascending: true });

  const initial: KitchenOrder[] = (orders ?? []).map((o) => {
    const tables = o.tables as { number: number; alias: string | null } | { number: number; alias: string | null }[] | null;
    const table = Array.isArray(tables) ? tables[0] : tables;
    return {
      id: o.id,
      status: o.status as KitchenOrder["status"],
      sent_to_kitchen_at: o.sent_to_kitchen_at,
      ready_at: o.ready_at,
      notes: o.notes,
      table_number: table?.number ?? null,
      table_alias: table?.alias ?? null,
      items: (o.order_items ?? []).map((it) => ({
        id: it.id,
        name: it.name_snapshot,
        qty: it.qty,
        notes: it.notes,
        station: it.station as KitchenOrder["items"][number]["station"],
        ready_at: it.ready_at,
      })),
    };
  });

  return <CocinaClient barId={profile.bar_id} initial={initial} />;
}
