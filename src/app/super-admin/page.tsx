import { redirect } from "next/navigation";
import IGSShell from "@/components/shell/IGSShell";
import IGSCard from "@/components/ui/IGSCard";
import IGSBadge from "@/components/ui/IGSBadge";
import IGSButton from "@/components/ui/IGSButton";
import { IGS, formatARS } from "@/lib/tokens";
import { createClient } from "@/lib/supabase/server";

const KPIS = [
  { label: "Bares activos", value: "142", trend: "+8", sub: "este mes" },
  { label: "MRR", value: "$ 4,26M", trend: "+$240k", sub: "vs mes ant." },
  { label: "Churn 30d", value: "2,1%", trend: "-0,4pp", sub: "3 bajas" },
  { label: "Trials activos", value: "19", trend: "+5", sub: "7 vencen esta sem." },
];

type Status = "active" | "trial" | "late" | "cancelled";
type Tone = "ok" | "warn" | "danger" | "neutral";

const BARS: { name: string; city: string; plan: string; tables: number; mrr: number; signup: string; status: Status }[] = [
  { name: "El Fogón", city: "Catamarca", plan: "Activo", tables: 22, mrr: 30000, signup: "15 dic 2025", status: "active" },
  { name: "Cuyen", city: "Fiambalá", plan: "Activo", tables: 14, mrr: 30000, signup: "03 ene 2026", status: "active" },
  { name: "La Esquina de Pancho", city: "Córdoba", plan: "Trial", tables: 8, mrr: 0, signup: "12 abr 2026", status: "trial" },
  { name: "Don Julián Parrilla", city: "Mendoza", plan: "Activo", tables: 36, mrr: 30000, signup: "28 oct 2025", status: "active" },
  { name: "Bar Los Tilos", city: "Tucumán", plan: "Activo", tables: 12, mrr: 30000, signup: "07 nov 2025", status: "active" },
  { name: "Rincón del Valle", city: "Salta", plan: "Pago vencido", tables: 18, mrr: 30000, signup: "22 jul 2025", status: "late" },
  { name: "Peña La Rumbita", city: "Jujuy", plan: "Activo", tables: 20, mrr: 30000, signup: "14 feb 2026", status: "active" },
  { name: "Almacén del Centro", city: "Rosario", plan: "Baja", tables: 0, mrr: 0, signup: "05 may 2025", status: "cancelled" },
];

const STATUS_TONE: Record<Status, Tone> = {
  active: "ok",
  trial: "warn",
  late: "danger",
  cancelled: "neutral",
};

const MONTHS = ["may", "jun", "jul", "ago", "sep", "oct", "nov", "dic", "ene", "feb", "mar", "abr"];
const MRR_DATA = [32, 38, 42, 48, 55, 61, 68, 82, 95, 108, 124, 142];

export default async function SuperAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "super_admin") redirect("/dashboard");

  return (
    <IGSShell hideSidebar bar={{ name: "IGS HQ", owner: "Equipo IGS", initials: "IG" }}>
      <div style={{ padding: "28px 32px", maxWidth: 1400 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 22 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <IGSBadge tone="accent">SUPER-ADMIN</IGSBadge>
              <div style={{ fontSize: 11.5, color: IGS.muted }}>Panel interno IGS · sólo administración</div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.6 }}>Red IGS — 142 bares activos</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <IGSButton variant="ghost" size="sm">Exportar CSV</IGSButton>
            <IGSButton variant="primary" size="sm" icon={<span style={{ fontSize: 15, marginTop: -2 }}>+</span>}>
              Alta manual
            </IGSButton>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
          {KPIS.map((k) => (
            <IGSCard key={k.label} padding={18}>
              <div style={{ fontSize: 11, color: IGS.muted, fontWeight: 500, letterSpacing: 0.2, marginBottom: 10 }}>
                {k.label.toUpperCase()}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
                <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.8, fontVariantNumeric: "tabular-nums" }}>
                  {k.value}
                </div>
                <IGSBadge tone="ok">{k.trend}</IGSBadge>
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
              <div style={{ fontSize: 11, color: IGS.muted, marginTop: 2 }}>Últimos 12 meses</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {["30d", "90d", "12m", "Todo"].map((p, i) => (
                <button
                  key={p}
                  style={{
                    padding: "5px 10px",
                    border: "none",
                    borderRadius: 8,
                    background: i === 2 ? IGS.ink : "transparent",
                    color: i === 2 ? "#fff" : IGS.muted,
                    fontSize: 11.5,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div style={{ padding: 20, height: 180, display: "flex", alignItems: "flex-end", gap: 6 }}>
            {MRR_DATA.map((v, i) => (
              <div
                key={i}
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
                    height: `${(v / 142) * 120}px`,
                    background: i === MRR_DATA.length - 1 ? IGS.accent : IGS.ink,
                    borderRadius: "4px 4px 0 0",
                    opacity: i === MRR_DATA.length - 1 ? 1 : 0.85,
                  }}
                />
                <div style={{ fontSize: 10, color: IGS.muted }}>{MONTHS[i]}</div>
              </div>
            ))}
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
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>Bares suscriptos</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", background: IGS.bg, borderRadius: 8 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={IGS.muted} strokeWidth="2">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.5-4.5" strokeLinecap="round" />
                </svg>
                <input
                  placeholder="Buscar bar, ciudad…"
                  style={{ border: "none", background: "transparent", outline: "none", fontSize: 11.5, fontFamily: "inherit", width: 160 }}
                />
              </div>
              <IGSButton variant="ghost" size="sm">Filtros</IGSButton>
            </div>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: IGS.bg }}>
                {["Bar", "Ciudad", "Estado", "Mesas", "MRR", "Alta", ""].map((h, i) => (
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
              {BARS.map((b) => (
                <tr key={b.name} style={{ borderTop: `1px solid ${IGS.line}`, cursor: "pointer" }}>
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
                        {b.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                      </div>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{b.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: "12px 20px", color: IGS.ink2 }}>{b.city}</td>
                  <td style={{ padding: "12px 20px" }}>
                    <IGSBadge tone={STATUS_TONE[b.status]}>{b.plan}</IGSBadge>
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
                  <td style={{ padding: "12px 20px", textAlign: "right" }}>
                    <button
                      aria-label="Acciones"
                      style={{ border: "none", background: "transparent", color: IGS.muted, cursor: "pointer", padding: 4 }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                        <circle cx="12" cy="5" r="1.5" />
                        <circle cx="12" cy="12" r="1.5" />
                        <circle cx="12" cy="19" r="1.5" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </IGSCard>
      </div>
    </IGSShell>
  );
}
