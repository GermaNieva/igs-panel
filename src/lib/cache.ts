import { unstable_cache } from "next/cache";
import { createAdminClient } from "./supabase/admin";

// Profile cacheado entre requests por user id. Usa el admin client porque
// unstable_cache no puede leer cookies(). Tags permiten invalidar por usuario
// o por bar (cuando cambia el nombre del bar).
export function getCachedProfileById(userId: string) {
  return unstable_cache(
    async (id: string) => {
      const admin = createAdminClient();
      const { data } = await admin
        .from("profiles")
        .select("id, full_name, role, bar_id, bars(name)")
        .eq("id", id)
        .maybeSingle();
      return data;
    },
    ["profile-by-id"],
    {
      revalidate: 60,
      tags: [`profile:user:${userId}`, "profile"],
    }
  )(userId);
}

export function profileTagForUser(userId: string) {
  return `profile:user:${userId}`;
}

// Stats del dashboard cacheadas por bar. TTL corto: el dashboard tolera
// 15-30s de staleness. Las mutaciones de orders/tables invalidan
// `dashboard:bar:{barId}` para refresh inmediato.
export function getCachedDashboardStats(
  barId: string,
  todayISO: string,
  sevenDaysISO: string
) {
  return unstable_cache(
    async (bid: string, today: string, sevenDays: string) => {
      const admin = createAdminClient();
      const [paidToday, ordersToday, inProgress, tables, paid7, recent, topItemsRaw] =
        await Promise.all([
          admin.from("orders").select("total").eq("bar_id", bid).eq("status", "paid").gte("paid_at", today),
          admin.from("orders").select("id", { count: "exact", head: true }).eq("bar_id", bid).gte("created_at", today),
          admin.from("orders").select("id", { count: "exact", head: true }).eq("bar_id", bid).in("status", ["confirmed", "in_kitchen", "ready"]),
          admin.from("tables").select("status").eq("bar_id", bid),
          admin.from("orders").select("total").eq("bar_id", bid).eq("status", "paid").gte("paid_at", sevenDays),
          admin.from("orders")
            .select("id, status, total, created_at, paid_at, called_at, sent_to_kitchen_at, ready_at, tables(number)")
            .eq("bar_id", bid)
            .order("created_at", { ascending: false })
            .limit(6),
          admin.from("order_items")
            .select("name_snapshot, qty, orders!inner(bar_id, created_at)")
            .eq("orders.bar_id", bid)
            .gte("orders.created_at", sevenDays),
        ]);
      return {
        paidToday: paidToday.data ?? [],
        ordersTodayCount: ordersToday.count ?? 0,
        inProgressCount: inProgress.count ?? 0,
        tables: tables.data ?? [],
        paid7: paid7.data ?? [],
        recent: recent.data ?? [],
        topItemsRaw: topItemsRaw.data ?? [],
      };
    },
    ["dashboard-stats"],
    {
      revalidate: 20,
      tags: [`dashboard:bar:${barId}`, "dashboard"],
    }
  )(barId, todayISO, sevenDaysISO);
}

export function dashboardTagForBar(barId: string) {
  return `dashboard:bar:${barId}`;
}
