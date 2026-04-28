"use client";
import { useState, useTransition } from "react";
import IGSCard from "@/components/ui/IGSCard";
import IGSBadge from "@/components/ui/IGSBadge";
import IGSButton from "@/components/ui/IGSButton";
import { IGS, formatARS } from "@/lib/tokens";
import {
  startSubscriptionAction,
  cancelSubscriptionAction,
  pauseSubscriptionAction,
  resumeSubscriptionAction,
  refreshSubscriptionAction,
} from "./actions";

export type PlanStatus = "trialing" | "active" | "past_due" | "paused" | "cancelled";

export type SubscriptionData = {
  barName: string;
  planStatus: PlanStatus;
  trialEndsAt: string | null;
  trialDaysLeft: number;
  hasPreapproval: boolean;
  canManage: boolean;
};

export type Invoice = {
  id: string;
  amount: number;
  period_start: string;
  period_end: string;
  status: "pending" | "paid" | "failed" | "refunded";
  paid_at: string | null;
  pdf_url: string | null;
};

const STATUS_LABELS: Record<PlanStatus, { l: string; tone: "ok" | "warn" | "danger" | "neutral" }> = {
  trialing:  { l: "En período de prueba", tone: "warn" },
  active:    { l: "● Al día",              tone: "ok" },
  past_due:  { l: "Pago vencido",          tone: "danger" },
  paused:    { l: "Pausada",               tone: "neutral" },
  cancelled: { l: "Cancelada",             tone: "neutral" },
};

const PLAN_FEATURES = [
  "Carta con QR ilimitada",
  "Mesas ilimitadas",
  "KDS para cocina",
  "Hasta 20 usuarios staff",
  "Pagos con MercadoPago",
  "Soporte en horario comercial",
];

export default function SuscripcionClient({
  data,
  invoices,
  justReturnedFromMP,
  returnStatus,
}: {
  data: SubscriptionData;
  invoices: Invoice[];
  justReturnedFromMP: boolean;
  returnStatus: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(initialInfoForReturn(justReturnedFromMP, returnStatus));
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleStart() {
    setError(null);
    setInfo(null);
    setShareUrl(null);
    startTransition(async () => {
      const res = await startSubscriptionAction();
      if (res.ok) {
        window.location.href = res.data.init_point;
      } else {
        setError(res.error);
      }
    });
  }

  function handleGenerateShareLink() {
    setError(null);
    setInfo(null);
    setCopied(false);
    startTransition(async () => {
      const res = await startSubscriptionAction();
      if (res.ok) {
        setShareUrl(res.data.init_point);
      } else {
        setError(res.error);
      }
    });
  }

  async function handleCopyShare() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignorar
    }
  }

  function handleRefresh() {
    setError(null);
    setInfo(null);
    setShareUrl(null);
    startTransition(async () => {
      const res = await refreshSubscriptionAction();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const { status, invoicesUpdated } = res.data;
      const statusLabel =
        status === "authorized"
          ? "✓ Suscripción autorizada — tu plan está activo."
          : status === "paused"
          ? "Suscripción pausada en MercadoPago."
          : status === "cancelled"
          ? "Tu suscripción está cancelada en MercadoPago."
          : status === "pending"
          ? "MercadoPago todavía está procesando tu pago. Probá de nuevo en unos minutos."
          : `Estado en MercadoPago: ${status}.`;
      setInfo(
        invoicesUpdated > 0
          ? `${statusLabel} (${invoicesUpdated} factura${invoicesUpdated === 1 ? "" : "s"} sincronizada${invoicesUpdated === 1 ? "" : "s"})`
          : statusLabel
      );
    });
  }

  function handleCancel() {
    if (!confirm("¿Seguro que querés cancelar la suscripción? Vas a perder acceso al final del período pagado.")) return;
    setError(null);
    startTransition(async () => {
      const res = await cancelSubscriptionAction();
      if (!res.ok) setError(res.error);
      else setInfo("Suscripción cancelada.");
    });
  }

  function handlePause() {
    setError(null);
    startTransition(async () => {
      const res = await pauseSubscriptionAction();
      if (!res.ok) setError(res.error);
      else setInfo("Suscripción pausada. Reactivá cuando quieras.");
    });
  }

  function handleResume() {
    setError(null);
    startTransition(async () => {
      const res = await resumeSubscriptionAction();
      if (!res.ok) setError(res.error);
      else setInfo("Suscripción reactivada.");
    });
  }

  const status = STATUS_LABELS[data.planStatus];
  const isTrialing = data.planStatus === "trialing";
  const isActive = data.planStatus === "active";
  const isPaused = data.planStatus === "paused";
  const isPastDue = data.planStatus === "past_due";
  const trialDaysLeft = data.trialDaysLeft;

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1100 }}>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.6 }}>Suscripción</div>
        <div style={{ fontSize: 12.5, color: IGS.muted, marginTop: 4 }}>
          Plan, método de pago e historial de facturas.
        </div>
      </div>

      {info && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            background: "rgba(106,158,127,0.12)",
            border: "1px solid rgba(106,158,127,0.3)",
            color: "#3f7a57",
            fontSize: 13,
            marginBottom: 14,
          }}
        >
          {info}
        </div>
      )}
      {error && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            background: "rgba(194,78,47,0.1)",
            border: "1px solid rgba(194,78,47,0.3)",
            color: "#a3391e",
            fontSize: 13,
            marginBottom: 14,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* PLAN */}
        <IGSCard
          padding={0}
          style={{
            background: IGS.ink,
            color: "#fff",
            border: "none",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0.1,
              backgroundImage: "radial-gradient(circle at 100% 0%, #c24e2f 0, transparent 50%)",
            }}
          />
          <div style={{ padding: 26, position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
              <div>
                <div
                  style={{
                    fontSize: 11,
                    color: "rgba(255,255,255,0.55)",
                    letterSpacing: 0.8,
                    fontWeight: 600,
                    marginBottom: 4,
                  }}
                >
                  PLAN ACTIVO
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>IGS Comedor</div>
              </div>
              <IGSBadge tone={status.tone} style={{ background: "rgba(255,255,255,0.12)", color: "#fff" }}>
                {status.l}
              </IGSBadge>
            </div>

            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 34, fontWeight: 700, letterSpacing: -1, fontVariantNumeric: "tabular-nums" }}>
                {formatARS(30000)}
              </span>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>/ mes</span>
            </div>

            {isTrialing && (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginBottom: 20 }}>
                {trialDaysLeft > 0
                  ? `Tu prueba gratuita termina en ${trialDaysLeft} ${trialDaysLeft === 1 ? "día" : "días"}.`
                  : "Tu prueba gratuita ya terminó. Activá el plan para seguir usando IGS."}
              </div>
            )}
            {isActive && (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginBottom: 20 }}>
                Plan activo · MercadoPago cobra automáticamente cada mes.
              </div>
            )}
            {isPastDue && (
              <div style={{ fontSize: 12, color: "#f5b9a4", marginBottom: 20 }}>
                ⚠ Tu último pago no se procesó. Actualizá el método o cobramos de nuevo en 24-48 hs.
              </div>
            )}
            {isPaused && (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginBottom: 20 }}>
                Tu suscripción está pausada — no se cobra hasta que la reactives.
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                fontSize: 12,
                color: "rgba(255,255,255,0.82)",
              }}
            >
              {PLAN_FEATURES.map((f) => (
                <div key={f} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "4px 0" }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" style={{ marginTop: 3, flexShrink: 0 }}>
                    <path
                      d="M2 6l3 3 5-7"
                      stroke="#7fbf9a"
                      strokeWidth="2"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {f}
                </div>
              ))}
            </div>
          </div>

          {data.canManage && (
            <div
              style={{
                padding: "14px 26px",
                borderTop: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                gap: 10,
                position: "relative",
                flexWrap: "wrap",
              }}
            >
              {(isTrialing || data.planStatus === "cancelled") && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
                  <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>
                    Te llevamos al checkout de MercadoPago. Pagás con tu cuenta o, si querés,
                    generás un link y se lo pasás a otra persona para que pague por vos.
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      onClick={handleStart}
                      disabled={pending}
                      style={{
                        padding: "10px 18px",
                        background: "#fff",
                        color: IGS.ink,
                        border: "none",
                        borderRadius: 22,
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: pending ? "wait" : "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      {pending ? "Conectando..." : "🔓 Activar plan ahora"}
                    </button>
                    <button
                      onClick={handleGenerateShareLink}
                      disabled={pending}
                      style={{
                        padding: "10px 16px",
                        background: "rgba(255,255,255,0.1)",
                        color: "#fff",
                        border: "1px solid rgba(255,255,255,0.2)",
                        borderRadius: 22,
                        fontSize: 12.5,
                        fontWeight: 500,
                        cursor: pending ? "wait" : "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      Generar link para que pague otra persona
                    </button>
                  </div>
                  {shareUrl && (
                    <div
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        padding: "12px 14px",
                        borderRadius: 10,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>
                        Link para compartir
                      </div>
                      <div
                        style={{
                          padding: "8px 10px",
                          borderRadius: 6,
                          background: "rgba(0,0,0,0.3)",
                          fontFamily: "ui-monospace, monospace",
                          fontSize: 11,
                          color: "#fff",
                          wordBreak: "break-all",
                        }}
                      >
                        {shareUrl}
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={handleCopyShare}
                          style={{
                            padding: "6px 12px",
                            background: "#fff",
                            color: IGS.ink,
                            border: "none",
                            borderRadius: 16,
                            fontSize: 11.5,
                            fontWeight: 600,
                            cursor: "pointer",
                            fontFamily: "inherit",
                          }}
                        >
                          {copied ? "✓ Copiado" : "Copiar"}
                        </button>
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(`Te paso el link para que pagues la suscripción de ${data.barName} en MercadoPago: ${shareUrl}`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            padding: "6px 12px",
                            background: "rgba(255,255,255,0.1)",
                            color: "#fff",
                            border: "1px solid rgba(255,255,255,0.2)",
                            borderRadius: 16,
                            fontSize: 11.5,
                            fontWeight: 500,
                            cursor: "pointer",
                            fontFamily: "inherit",
                            textDecoration: "none",
                          }}
                        >
                          Enviar por WhatsApp
                        </a>
                      </div>
                      <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>
                        Quien abra el link se loguea con su cuenta de MercadoPago y paga con su
                        tarjeta — no hace falta que coincida con tu email.
                      </div>
                    </div>
                  )}
                </div>
              )}
              {(isActive || isPastDue) && (
                <>
                  <button
                    onClick={handlePause}
                    disabled={pending}
                    style={{
                      padding: "8px 14px",
                      background: "rgba(255,255,255,0.1)",
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    Pausar
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={pending}
                    style={{
                      padding: "8px 14px",
                      background: "transparent",
                      color: "rgba(255,255,255,0.6)",
                      border: "none",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    Cancelar plan
                  </button>
                </>
              )}
              {isPaused && (
                <button
                  onClick={handleResume}
                  disabled={pending}
                  style={{
                    padding: "10px 18px",
                    background: "#fff",
                    color: IGS.ink,
                    border: "none",
                    borderRadius: 22,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  ▶ Reactivar plan
                </button>
              )}
            </div>
          )}
        </IGSCard>

        {/* MÉTODO DE PAGO */}
        <IGSCard>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Método de pago</div>
          {data.hasPreapproval ? (
            <div
              style={{
                padding: 14,
                borderRadius: 10,
                background: IGS.bg,
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  width: 42,
                  height: 28,
                  background: "#009ee3",
                  borderRadius: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: 0.3,
                }}
              >
                MP
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>MercadoPago</div>
                <div style={{ fontSize: 11, color: IGS.muted }}>Cobro mensual automático</div>
              </div>
              <IGSBadge tone={isActive ? "ok" : "neutral"}>
                {isActive ? "Activo" : status.l}
              </IGSBadge>
            </div>
          ) : (
            <div
              style={{
                padding: 14,
                borderRadius: 10,
                background: IGS.bg,
                fontSize: 12,
                color: IGS.muted,
                marginBottom: 10,
              }}
            >
              Todavía no configuraste un método de pago. Tocá <b>Activar plan</b> para hacerlo.
            </div>
          )}

          {data.canManage && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${IGS.line}` }}>
              <button
                onClick={handleRefresh}
                disabled={pending}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "transparent",
                  color: IGS.ink2,
                  border: `1px solid ${IGS.line2}`,
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: pending ? "wait" : "pointer",
                  fontFamily: "inherit",
                }}
              >
                {pending ? "Verificando..." : "↻ Verificar estado en MercadoPago"}
              </button>
              <div style={{ fontSize: 10.5, color: IGS.muted, marginTop: 6, lineHeight: 1.4 }}>
                Si pagaste y no ves tu plan activo, tocá acá para reconciliar con MP.
              </div>
            </div>
          )}

          <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${IGS.line}` }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: IGS.ink2, marginBottom: 8 }}>
              Datos de facturación
            </div>
            <div style={{ fontSize: 12, color: IGS.muted, lineHeight: 1.5 }}>
              Editor de datos fiscales — próximo paso.
            </div>
          </div>
        </IGSCard>
      </div>

      {/* HISTORIAL */}
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
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>Historial de facturas</div>
          {invoices.length > 0 && (
            <IGSButton variant="ghost" size="sm" disabled>
              Descargar todas
            </IGSButton>
          )}
        </div>
        {invoices.length === 0 ? (
          <div style={{ padding: "30px 20px", textAlign: "center", color: IGS.muted, fontSize: 12.5 }}>
            Cuando cobremos tu primer mes, las facturas aparecen acá.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: IGS.bg }}>
                {["Período", "Monto", "Estado", "Pagada", ""].map((h, i) => (
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
              {invoices.map((inv) => (
                <tr key={inv.id} style={{ borderTop: `1px solid ${IGS.line}` }}>
                  <td style={{ padding: "14px 20px" }}>
                    {fmtDate(inv.period_start)} → {fmtDate(inv.period_end)}
                  </td>
                  <td style={{ padding: "14px 20px", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                    {formatARS(inv.amount)}
                  </td>
                  <td style={{ padding: "14px 20px" }}>
                    <IGSBadge tone={inv.status === "paid" ? "ok" : inv.status === "failed" ? "danger" : "neutral"}>
                      {inv.status === "paid" ? "✓ Pagada" : inv.status === "failed" ? "Falló" : inv.status === "refunded" ? "Reembolsada" : "Pendiente"}
                    </IGSBadge>
                  </td>
                  <td style={{ padding: "14px 20px", color: IGS.muted, fontSize: 12 }}>
                    {inv.paid_at ? fmtDate(inv.paid_at) : "—"}
                  </td>
                  <td style={{ padding: "14px 20px", textAlign: "right" }}>
                    {inv.pdf_url ? (
                      <a
                        href={inv.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: IGS.accent,
                          fontSize: 12,
                          fontWeight: 600,
                          textDecoration: "none",
                        }}
                      >
                        PDF →
                      </a>
                    ) : (
                      <span style={{ color: IGS.muted, fontSize: 11 }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </IGSCard>
    </div>
  );
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

function initialInfoForReturn(justReturned: boolean, status: string | null): string | null {
  if (!justReturned) return null;
  if (status === "authorized") {
    return "✓ Suscripción autorizada. Tu plan ya está activo.";
  }
  if (status === "pending") {
    return "Volviste de MercadoPago, pero la suscripción todavía está pendiente. Si pagaste, en unos minutos la activamos automáticamente.";
  }
  if (status === "cancelled") {
    return "La suscripción figura como cancelada en MercadoPago.";
  }
  return "Volviste de MercadoPago. Si autorizaste el pago, lo verificamos automáticamente.";
}
