import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentProfile } from "@/lib/supabase/auth";
import { getCachedDashboardStats } from "@/lib/cache";
import IGSCard from "@/components/ui/IGSCard";
import IGSBadge from "@/components/ui/IGSBadge";
import IGSButton from "@/components/ui/IGSButton";
import { IGS, formatARS } from "@/lib/tokens";

const STATUS_LABEL: Record<string, { label: string; tone: "accent" | "ok" | "warn" | "neutral" }> = {
  drafting:        { label: "Armando pedido",       tone: "neutral" },
  calling_waiter:  { label: "Llamó al mozo",        tone: "warn" },
  confirmed:       { label: "Confirmado",           tone: "accent" },
  in_kitchen:      { label: "Pedido enviado a cocina", tone: "accent" },
  ready:           { label: "Listo para servir",    tone: "ok" },
  served:          { label: "Servido",              tone: "neutral" },
  paid:            { label: "Cuenta pagada",        tone: "neutral" },
  cancelled:       { label: "Cancelado",            tone: "neutral" },
};

const TIME_FMT = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });

const toneColor = (t: "accent" | "ok" | "warn" | "neutral") =>
  t === "accent" ? IGS.accent : t === "ok" ? IGS.ok : t === "warn" ? IGS.warn : IGS.line2;

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/ingresar");

  const profile = await getCurrentProfile();
  if (!profile?.bar_id) {
    return <div style={{ padding: 32 }}>Tu cuenta no tiene un bar asociado.</div>;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();
  // Redondear sevenDaysAgo al inicio de la hora para que sea estable como cache key
  // dentro de la misma hora; combinado con TTL corto da buena precisión sin
  // invalidar el cache cada milisegundo.
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setMinutes(0, 0, 0);
  const sevenDaysISO = sevenDaysAgo.toISOString();

  const cached = await getCachedDashboardStats(profile.bar_id, todayISO, sevenDaysISO);
  const { paidToday, ordersTodayCount, inProgressCount, tables, paid7, recent, topItemsRaw } = cached;

  const revenueToday = paidToday.reduce((s, o) => s + (o.total ?? 0), 0);
  const tablesAll = tables;
  const tablesTotal = tablesAll.length;
  const tablesOccupied = tablesAll.filter((t) => t.status !== "free").length;
  const occupancy = tablesTotal > 0 ? Math.round((tablesOccupied / tablesTotal) * 100) : 0;

  const paid7Total = paid7.reduce((s, o) => s + (o.total ?? 0), 0);
  const avgTicket = paid7.length ? Math.round(paid7Total / paid7.length) : 0;

  // Top items (agrupar en JS porque Postgres GROUP BY con joins desde el cliente es engorroso)
  const topMap = new Map<string, number>();
  for (const it of topItemsRaw) {
    topMap.set(it.name_snapshot, (topMap.get(it.name_snapshot) ?? 0) + (it.qty ?? 0));
  }
  const topItems = [...topMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));
  const topMaxCount = topItems[0]?.count ?? 1;

  const ownerFirstName = (profile.full_name ?? user.email?.split("@")[0] ?? "")
    .trim()
    .split(" ")[0];
  const todayLabel = new Date().toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const timeLabel = TIME_FMT.format(new Date());

  const stats = [
    {
      label: "Facturación hoy",
      value: revenueToday > 0 ? formatARS(revenueToday) : "—",
      sub: revenueToday > 0 ? "pagado hoy" : "todavía sin cobros hoy",
    },
    {
      label: "Pedidos",
      value: String(ordersTodayCount),
      sub: inProgressCount > 0 ? `en curso ahora ${inProgressCount}` : "ninguno en curso",
    },
    {
      label: "Ticket promedio",
      value: avgTicket > 0 ? formatARS(avgTicket) : "—",
      sub: "últimos 7 días",
    },
    {
      label: "Mesas ocupadas",
      value: tablesTotal > 0 ? `${tablesOccupied}/${tablesTotal}` : "—",
      sub: tablesTotal > 0 ? `${occupancy}% del salón` : "agregá mesas en /mesas",
    },
  ];

  const timeline = recent.map((o) => {
    const eventTime = pickMostRecent([
      o.paid_at,
      o.ready_at,
      o.sent_to_kitchen_at,
      o.called_at,
      o.created_at,
    ]);
    const status = STATUS_LABEL[o.status] ?? STATUS_LABEL.drafting;
    // tables(number) viene como objeto o array según select
    const tablesField = o.tables as { number: number } | { number: number }[] | null;
    const tableNumber = Array.isArray(tablesField) ? tablesField[0]?.number : tablesField?.number;
    return {
      id: o.id,
      time: eventTime ? TIME_FMT.format(new Date(eventTime)) : "",
      mesa: tableNumber != null ? `Mesa ${String(tableNumber).padStart(2, "0")}` : "Sin mesa",
      action: status.label,
      tone: status.tone,
      total: o.status === "paid" ? o.total : null,
    };
  });

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1400 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 12, color: IGS.muted, letterSpacing: 0.3, marginBottom: 4, textTransform: "capitalize" }}>
            {todayLabel} · {timeLabel}
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.6 }}>
            Hola {ownerFirstName || "👋"} 👋
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <IGSButton variant="ghost" size="sm" disabled icon={<span style={{ fontSize: 14 }}>↓</span>}>
            Exportar
          </IGSButton>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
        {stats.map((s) => (
          <IGSCard key={s.label} padding={18}>
            <div style={{ fontSize: 11, color: IGS.muted, fontWeight: 500, letterSpacing: 0.2, marginBottom: 10 }}>
              {s.label.toUpperCase()}
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.8, fontVariantNumeric: "tabular-nums", marginBottom: 6 }}>
              {s.value}
            </div>
            <div style={{ fontSize: 11, color: IGS.muted }}>{s.sub}</div>
          </IGSCard>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 14 }}>
        <IGSCard padding={0}>
          <div
            style={{
              padding: "16px 20px",
              borderBottom: `1px solid ${IGS.line}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: -0.2 }}>Actividad del salón</div>
              <div style={{ fontSize: 11, color: IGS.muted, marginTop: 2 }}>
                Últimos movimientos de pedidos
              </div>
            </div>
            <IGSBadge tone="ok">● En vivo</IGSBadge>
          </div>
          {timeline.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center", color: IGS.muted, fontSize: 12.5 }}>
              Todavía no hay pedidos. Cuando un cliente escanee el QR de una mesa, aparece acá.
            </div>
          ) : (
            <div>
              {timeline.map((t, i) => (
                <div
                  key={t.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "14px 20px",
                    borderBottom: i < timeline.length - 1 ? `1px solid ${IGS.line}` : "none",
                    gap: 14,
                  }}
                >
                  <div style={{ fontSize: 11.5, color: IGS.muted, fontVariantNumeric: "tabular-nums", width: 42 }}>
                    {t.time}
                  </div>
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: toneColor(t.tone) }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 1 }}>{t.mesa}</div>
                    <div style={{ fontSize: 11.5, color: IGS.muted }}>{t.action}</div>
                  </div>
                  {t.total != null && (
                    <div style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                      {formatARS(t.total)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </IGSCard>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <IGSCard padding={0}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${IGS.line}` }}>
              <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: -0.2 }}>Lo más pedido</div>
              <div style={{ fontSize: 11, color: IGS.muted, marginTop: 2 }}>Últimos 7 días</div>
            </div>
            {topItems.length === 0 ? (
              <div style={{ padding: "30px 20px", textAlign: "center", color: IGS.muted, fontSize: 12.5 }}>
                Cuando empiecen a entrar pedidos, los top 5 aparecen acá.
              </div>
            ) : (
              <div style={{ padding: "14px 20px 18px" }}>
                {topItems.map((t, i) => {
                  const pct = topMaxCount > 0 ? Math.round((t.count / topMaxCount) * 100) : 0;
                  return (
                    <div key={t.name} style={{ marginBottom: i < topItems.length - 1 ? 12 : 0 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 5,
                        }}
                      >
                        <span style={{ fontSize: 12.5, fontWeight: 500 }}>{t.name}</span>
                        <span
                          style={{ fontSize: 12, color: IGS.muted, fontVariantNumeric: "tabular-nums" }}
                        >
                          {t.count}
                        </span>
                      </div>
                      <div style={{ height: 4, background: IGS.bg, borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: IGS.accent, borderRadius: 2 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </IGSCard>

          <IGSCard padding={18} style={{ background: IGS.ink, color: "#fff", border: "none" }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", letterSpacing: 0.5, marginBottom: 8, fontWeight: 600 }}>
              ESTADO DEL SERVICIO
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: -0.3, marginBottom: 14 }}>
              Todo funcionando
            </div>
            {[
              { l: "Carta digital", on: true },
              { l: "KDS cocina", on: false },
              { l: "Pagos MP", on: false },
            ].map((s, i) => (
              <div
                key={s.l}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "7px 0",
                  borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.75)" }}>{s.l}</span>
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 11,
                    color: s.on ? "#7fbf9a" : "rgba(255,255,255,0.4)",
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      background: s.on ? "#7fbf9a" : "rgba(255,255,255,0.3)",
                    }}
                  />
                  {s.on ? "OK" : "Próximo paso"}
                </span>
              </div>
            ))}
          </IGSCard>
        </div>
      </div>
    </div>
  );
}

function pickMostRecent(dates: (string | null)[]): string | null {
  let best: string | null = null;
  let bestMs = 0;
  for (const d of dates) {
    if (!d) continue;
    const ms = new Date(d).getTime();
    if (ms > bestMs) {
      best = d;
      bestMs = ms;
    }
  }
  return best;
}
