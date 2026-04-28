import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getCurrentProfile } from "@/lib/supabase/auth";
import MesasClient, { type Zone, type Mesa, type Llamada } from "./MesasClient";

export default async function MesasPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/ingresar");

  const profile = await getCurrentProfile();
  if (!profile?.bar_id) {
    return <div style={{ padding: 32 }}>Tu cuenta no tiene un bar asociado.</div>;
  }

  const supabase = await createClient();
  const [{ data: bar }, { data: zones }, { data: tables }, { data: callingOrders }] = await Promise.all([
    supabase.from("bars").select("slug, name").eq("id", profile.bar_id).maybeSingle(),
    supabase.from("zones").select("id, name, sort").eq("bar_id", profile.bar_id).order("sort"),
    supabase
      .from("tables")
      .select("id, number, alias, seats, zone_id, status, called_at")
      .eq("bar_id", profile.bar_id)
      .order("number"),
    supabase
      .from("orders")
      .select("id, table_id, called_at, total")
      .eq("bar_id", profile.bar_id)
      .eq("status", "calling_waiter"),
  ]);

  const zonesList: Zone[] = (zones ?? []).map((z) => ({ id: z.id, name: z.name }));
  const mesas: Mesa[] = (tables ?? []).map((t) => ({
    id: t.id,
    number: t.number,
    alias: t.alias,
    seats: t.seats,
    zone_id: t.zone_id,
    status: t.status as Mesa["status"],
    called_at: t.called_at,
  }));
  const llamadas: Llamada[] = (callingOrders ?? []).map((o) => ({
    order_id: o.id,
    table_id: o.table_id ?? "",
    called_at: o.called_at ?? "",
    total: o.total ?? 0,
  }));

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const slug = bar?.slug ?? "tu-bar";

  return (
    <MesasClient
      slug={slug}
      barName={bar?.name ?? "Tu bar"}
      baseUrl={baseUrl}
      zones={zonesList}
      mesas={mesas}
      llamadas={llamadas}
    />
  );
}
