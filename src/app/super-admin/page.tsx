import { redirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import IGSShell from "@/components/shell/IGSShell";
import IGSCard from "@/components/ui/IGSCard";
import IGSBadge from "@/components/ui/IGSBadge";
import IGSButton from "@/components/ui/IGSButton";
import { IGS, formatARS } from "@/lib/tokens";
import { getCurrentUser, getCurrentProfile } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";

type Status = "active" | "trial" | "late" | "cancelled" | "paused";
type Tone = "ok" | "warn" | "danger" | "neutral";

const STATUS_TONE: Record<Status, Tone> = {
  active: "ok",
  trial: "warn",
  late: "danger",
  cancelled: "neutral",
  paused: "neutral",
};

const STATUS_LABEL: Record<Status, string> = {
  active: "Activo",
  trial: "Trial",
  late: "Pago vencido",
  cancelled: "Baja",
  paused: "Pausado",
};

function dbStatusToUi(s: string | null): Status {
  switch (s) {
    case "active":
      return "active";
    case "trialing":
      return "trial";
    case "past_due":
      return "late";
    case "paused":
      return "paused";
    case "cancelled":
      return "cancelled";
    default:
      return "trial";
  }
}

const MONTH_LABELS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const fmtSignup = (iso: string | null): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, "0")} ${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`;
};

type SuperAdminData = {
  kpis: {
    activeBars: number;
    activeBarsDelta: number;
    trialBars: number;
    trialEndingSoon: number;
    cancelled30d: number;
    totalBars: number;
    mrrCurrent: number;
    mrrDelta: number;
  };
  barsList: {
    id: string;
    name: string;
    city: string | null;
    status: Status;
    tables: number;
    mrr: number;
    signup: string;
    initials: string;
  }[];
  mrrSeries: { month: string; total: number; isCurrent: boolean }[];
};

const getSuperAdminData = unstable_cache(
  async (): Promise<SuperAdminData> => {
    const admin = createAdminClient();

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const [bars, tables, invoicesYear] = await Promise.all([
      admin
        .from("bars")
        .select("id, name, city, plan_status, created_at, updated_at, trial_ends_at")
        .order("created_at", { ascending: false }),
      admin.from("tables").select("bar_id"),
      admin
        .from("invoices")
        .select("bar_id, amount, paid_at, status")
        .eq("status", "paid")
        .gte("paid_at", twelveMonthsAgo.toISOString()),
    ]);

    const barRows = bars.data ?? [];
    const tableRows = tables.data ?? [];
    const invoiceRows = invoicesYear.data ?? [];

    // KPIs
    const activeBars = barRows.filter((b) => b.plan_status === "active").length;
    const trialBars = barRows.filter((b) => b.plan_status === "trialing").length;
    const cancelled30d = barRows.filter(
      (b) => b.plan_status === "cancelled" && b.updated_at && new Date(b.updated_at) >= thirtyDaysAgo
    ).length;
    const trialEndingSoon = barRows.filter((b) => {
      if (b.plan_status !== "trialing" || !b.trial_ends_at) return false;
      const end = new Date(b.trial_ends_at);
      const inSeven = new Date(now);
      inSeven.setDate(inSeven.getDate() + 7);
      return end <= inSeven;
    }).length;

    // Bares activos hace 30 días: total bares - los que pasaron a active en últimos 30d.
    // Aproximación simple: activos hoy - aquellos con updated_at >30d → asumimos eran active antes.
    // Para MVP usamos delta = activos hoy - bares creados últimos 30 días que estén activos.
    const activeNewLast30 = barRows.filter(
      (b) => b.plan_status === "active" && b.created_at && new Date(b.created_at) >= thirtyDaysAgo
    ).length;
    const activeBarsDelta = activeNewLast30; // delta positivo = altas netas del último mes

    // MRR: revenue cobrado este mes vs mes anterior
    let mrrCurrent = 0;
    let mrrPrev = 0;
    for (const inv of invoiceRows) {
      if (!inv.paid_at) continue;
      const paid = new Date(inv.paid_at);
      if (paid >= startOfMonth) mrrCurrent += inv.amount ?? 0;
      else if (paid >= startOfPrevMonth && paid < startOfMonth) mrrPrev += inv.amount ?? 0;
    }
    const mrrDelta = mrrCurrent - mrrPrev;

    // MRR por mes (12 meses)
    const monthBuckets = new Map<string, number>();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthBuckets.set(monthKey(d), 0);
    }
    for (const inv of invoiceRows) {
      if (!inv.paid_at) continue;
      const k = monthKey(new Date(inv.paid_at));
      if (monthBuckets.has(k)) monthBuckets.set(k, (monthBuckets.get(k) ?? 0) + (inv.amount ?? 0));
    }
    const mrrSeries = [...monthBuckets.entries()].map(([k, total], idx, arr) => ({
      month: MONTH_LABELS[parseInt(k.split("-")[1], 10) - 1],
      total,
      isCurrent: idx === arr.length - 1,
    }));

    // Tablas por bar
    const tablesByBar = new Map<string, number>();
    for (const t of tableRows) {
      tablesByBar.set(t.bar_id, (tablesByBar.get(t.bar_id) ?? 0) + 1);
    }

    // MRR por bar este mes
    const mrrByBar = new Map<string, number>();
    for (const inv of invoiceRows) {
      if (!inv.paid_at) continue;
      const paid = new Date(inv.paid_at);
      if (paid >= startOfMonth) {
        mrrByBar.set(inv.bar_id, (mrrByBar.get(inv.bar_id) ?? 0) + (inv.amount ?? 0));
      }
    }

    const barsList = barRows.map((b) => ({
      id: b.id,
      name: b.name,
      city: b.city,
      status: dbStatusToUi(b.plan_status),
      tables: tablesByBar.get(b.id) ?? 0,
      mrr: mrrByBar.get(b.id) ?? 0,
      signup: fmtSignup(b.created_at),
      initials: (b.name || "?")
        .split(" ")
        .map((w: string) => w[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase(),
    }));

    return {
      kpis: {
        activeBars,
        activeBarsDelta,
        trialBars,
        trialEndingSoon,
        cancelled30d,
        totalBars: barRows.length,
        mrrCurrent,
        mrrDelta,
      },
      barsList,
      mrrSeries,
    };
  },
  ["super-admin-data"],
  { revalidate: 300, tags: ["super-admin"] }
);

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`;
}

function fmtCompactARS(amount: number): string {
  if (amount >= 1_000_000) return `$ ${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 10_000) return `$ ${Math.round(amount / 1000)}k`;
  return formatARS(amount);
}

function fmtDeltaARS(delta: number): string {
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${fmtCompactARS(Math.abs(delta) * (delta < 0 ? -1 : 1)).replace("$ ", "$")}`;
}

export default async function SuperAdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/ingresar");
  const profile = await getCurrentProfile();
  if (profile?.role !== "super_admin") redirect("/dashboard");

  const data = await getSuperAdminData();

  const churnPct =
    data.kpis.totalBars > 0
      ? ((data.kpis.cancelled30d / data.kpis.totalBars) * 100).toFixed(1)
      : "0.0";

  const kpis = [
    {
      label: "Bares activos",
      value: data.kpis.activeBars.toString(),
      trend: data.kpis.activeBarsDelta > 0 ? `+${data.kpis.activeBarsDelta}` : `${data.kpis.activeBarsDelta}`,
      trendTone: (data.kpis.activeBarsDelta >= 0 ? "ok" : "danger") as Tone,
      sub: data.kpis.activeBarsDelta > 0 ? "altas últimos 30d" : "neto últimos 30d",
    },
    {
      label: "MRR",
      value: data.kpis.mrrCurrent > 0 ? fmtCompactARS(data.kpis.mrrCurrent) : "—",
      trend: data.kpis.mrrDelta !== 0 ? fmtDeltaARS(data.kpis.mrrDelta) : "—",
      trendTone: (data.kpis.mrrDelta >= 0 ? "ok" : "danger") as Tone,
      sub: "vs mes ant.",
    },
    {
      label: "Churn 30d",
      value: `${churnPct}%`,
      trend: data.kpis.cancelled30d > 0 ? `${data.kpis.cancelled30d} bajas` : "0 bajas",
      trendTone: (data.kpis.cancelled30d === 0 ? "ok" : "danger") as Tone,
      sub: "últimos 30 días",
    },
    {
      label: "Trials activos",
      value: data.kpis.trialBars.toString(),
      trend: data.kpis.trialEndingSoon > 0 ? `${data.kpis.trialEndingSoon} próx.` : "0 próx.",
      trendTone: "warn" as Tone,
      sub: "vencen esta sem.",
    },
  ];

  const maxMrr = Math.max(...data.mrrSeries.map((m) => m.total), 1);

  return (
    <IGSShell hideSidebar bar={{ name: "IGS HQ", owner: "Equipo IGS", initials: "IG" }}>
      <div style={{ padding: "28px 32px", maxWidth: 1400 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 22 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <IGSBadge tone="accent">SUPER-ADMIN</IGSBadge>
              <div style={{ fontSize: 11.5, color: IGS.muted }}>Panel interno IGS · sólo administración</div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.6 }}>
              Red IGS — {data.kpis.totalBars} {data.kpis.totalBars === 1 ? "bar" : "bares"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <IGSButton variant="ghost" size="sm" disabled>Exportar CSV</IGSButton>
            <IGSButton variant="primary" size="sm" disabled icon={<span style={{ fontSize: 15, marginTop: -2 }}>+</span>}>
              Alta manual
            </IGSButton>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
          {kpis.map((k) => (
            <IGSCard key={k.label} padding={18}>
              <div style={{ fontSize: 11, color: IGS.muted, fontWeight: 500, letterSpacing: 0.2, marginBottom: 10 }}>
                {k.label.toUpperCase()}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
                <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.8, fontVariantNumeric: "tabular-nums" }}>
                  {k.value}
                </div>
                <IGSBadge tone={k.trendTone}>{k.trend}</IGSBadge>
              </div>
              <div style={{ fontSize: 11, color: IGS.muted }}>{k.sub}</div>
            </IGSCard>
          ))}
        </div>

        <IGSCard padding={0} style={{ marginBottom: 16 }}>
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
              <div style={{ fontSize: 14, fontWeight: 600 }}>Crecimiento MRR</div>
              <div style={{ fontSize: 11, color: IGS.muted, marginTop: 2 }}>Últimos 12 meses · revenue cobrado</div>
            </div>
          </div>
          <div style={{ padding: 20, height: 180, display: "flex", alignItems: "flex-end", gap: 6 }}>
            {data.mrrSeries.map((m, i) => {
              const heightPct = maxMrr > 0 ? (m.total / maxMrr) * 100 : 0;
              return (
                <div
                  key={i}
                  title={`${m.month}: ${formatARS(m.total)}`}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    height: "100%",
                    justifyContent: "flex-end",
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      height: `${Math.max(heightPct * 1.2, m.total > 0 ? 4 : 1)}px`,
                      background: m.isCurrent ? IGS.accent : IGS.ink,
                      borderRadius: "4px 4px 0 0",
                      opacity: m.total > 0 ? (m.isCurrent ? 1 : 0.85) : 0.15,
                    }}
                  />
                  <div style={{ fontSize: 10, color: IGS.muted }}>{m.month}</div>
                </div>
              );
            })}
          </div>
        </IGSCard>

        <IGSCard padding={0}>
          <div
            style={{
              padding: "14px 20px",
              borderBottom: `1px solid ${IGS.line}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>
              Bares suscriptos {data.barsList.length > 0 && <span style={{ color: IGS.muted, fontWeight: 500 }}>· {data.barsList.length}</span>}
            </div>
          </div>
          {data.barsList.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center", color: IGS.muted, fontSize: 13 }}>
              Todavía no hay bares en la red.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: IGS.bg }}>
                  {["Bar", "Ciudad", "Estado", "Mesas", "MRR mes", "Alta"].map((h, i) => (
                    <th
                      key={i}
                      style={{
                        textAlign: "left",
                        padding: "10px 20px",
                        fontSize: 10.5,
                        color: IGS.muted,
                        fontWeight: 600,
                        letterSpacing: 0.5,
                        textTransform: "uppercase",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.barsList.map((b) => (
                  <tr key={b.id} style={{ borderTop: `1px solid ${IGS.line}` }}>
                    <td style={{ padding: "12px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: 8,
                            background: IGS.bg,
                            color: IGS.ink,
                            fontSize: 11,
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {b.initials || "?"}
                        </div>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{b.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: "12px 20px", color: IGS.ink2 }}>{b.city ?? "—"}</td>
                    <td style={{ padding: "12px 20px" }}>
                      <IGSBadge tone={STATUS_TONE[b.status]}>{STATUS_LABEL[b.status]}</IGSBadge>
                    </td>
                    <td style={{ padding: "12px 20px", fontVariantNumeric: "tabular-nums" }}>{b.tables || "—"}</td>
                    <td
                      style={{
                        padding: "12px 20px",
                        fontWeight: 600,
                        fontVariantNumeric: "tabular-nums",
                        color: b.mrr ? IGS.ink : IGS.muted,
                      }}
                    >
                      {b.mrr ? formatARS(b.mrr) : "—"}
                    </td>
                    <td style={{ padding: "12px 20px", color: IGS.muted, fontSize: 12 }}>{b.signup}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </IGSCard>
      </div>
    </IGSShell>
  );
}
