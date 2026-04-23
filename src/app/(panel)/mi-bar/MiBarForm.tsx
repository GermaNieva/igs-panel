"use client";
import { useState, useTransition } from "react";
import IGSCard from "@/components/ui/IGSCard";
import IGSInput from "@/components/ui/IGSInput";
import IGSButton from "@/components/ui/IGSButton";
import IGSBadge from "@/components/ui/IGSBadge";
import { IGS, formatARS } from "@/lib/tokens";
import { updateBarAction, type BarUpdate } from "./actions";

const HORARIOS = [
  { d: "Lunes", hs: "Cerrado", off: true },
  { d: "Martes", hs: "20:00 — 00:30" },
  { d: "Miércoles", hs: "20:00 — 00:30" },
  { d: "Jueves", hs: "20:00 — 00:30" },
  { d: "Viernes", hs: "20:00 — 02:00" },
  { d: "Sábado", hs: "12:00 — 15:30 · 20:00 — 02:00" },
  { d: "Domingo", hs: "12:00 — 15:30" },
];

type Props = {
  initial: BarUpdate;
};

export default function MiBarForm({ initial }: Props) {
  const [form, setForm] = useState<BarUpdate>(initial);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  function update<K extends keyof BarUpdate>(key: K, value: BarUpdate[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setFeedback(null);
  }

  function updateSocial(key: keyof BarUpdate["socials"], value: string) {
    setForm((f) => ({ ...f, socials: { ...f.socials, [key]: value } }));
    setFeedback(null);
  }

  function handleSave() {
    setFeedback(null);
    startTransition(async () => {
      const res = await updateBarAction(form);
      setFeedback(
        res.ok ? { ok: true, msg: "Cambios guardados." } : { ok: false, msg: res.error }
      );
    });
  }

  function handleDiscard() {
    setForm(initial);
    setFeedback(null);
  }

  const initials =
    form.name
      .split(" ")
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "EF";

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1200 }}>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.6 }}>Mi bar</div>
        <div style={{ fontSize: 12.5, color: IGS.muted, marginTop: 4 }}>
          Esto es lo que ven tus clientes cuando escanean el QR.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <IGSCard>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Identidad</div>
            <div style={{ fontSize: 11.5, color: IGS.muted, marginBottom: 18 }}>
              Nombre, logo y foto de portada.
            </div>
            <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: IGS.ink2, marginBottom: 6 }}>
                  Logo
                </div>
                <div
                  style={{
                    width: 88,
                    height: 88,
                    borderRadius: 14,
                    background: IGS.ink,
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 28,
                    fontWeight: 700,
                    letterSpacing: -1,
                    position: "relative",
                  }}
                >
                  {initials}
                  <button
                    aria-label="Cambiar logo"
                    title="La subida de logo se activa en el próximo paso (Storage)"
                    disabled
                    style={{
                      position: "absolute",
                      bottom: -6,
                      right: -6,
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      background: "#fff",
                      border: `1px solid ${IGS.line2}`,
                      cursor: "not-allowed",
                      opacity: 0.5,
                      fontSize: 12,
                      color: IGS.ink,
                    }}
                  >
                    ✎
                  </button>
                </div>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
                <IGSInput
                  label="Nombre del bar"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                />
                <IGSInput
                  label="Subtítulo / tagline"
                  placeholder="Ej: Comedor catamarqueño · desde 1998"
                  value={form.tagline ?? ""}
                  onChange={(e) => update("tagline", e.target.value)}
                />
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: IGS.ink2, marginBottom: 6 }}>
                Foto de portada
              </div>
              <div
                style={{
                  height: 140,
                  borderRadius: 10,
                  background: "linear-gradient(135deg, #d9a66b 0%, #b86340 100%)",
                  border: `1px solid ${IGS.line}`,
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: 0.7,
                }}
              >
                <div style={{ color: "rgba(255,255,255,0.95)", fontSize: 11.5, fontWeight: 500 }}>
                  Subida de portada — próximo paso (Storage)
                </div>
              </div>
            </div>
          </IGSCard>

          <IGSCard>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
              Mensaje de bienvenida
            </div>
            <div style={{ fontSize: 11.5, color: IGS.muted, marginBottom: 14 }}>
              Aparece arriba de la carta cuando el cliente escanea.
            </div>
            <textarea
              value={form.welcome_msg ?? ""}
              placeholder="¡Bienvenido! Llamá al mozo cuando estés listo para pedir."
              onChange={(e) => update("welcome_msg", e.target.value)}
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 10,
                border: `1px solid ${IGS.line2}`,
                background: "#fff",
                fontSize: 13,
                fontFamily: "inherit",
                color: IGS.ink,
                resize: "none",
                minHeight: 72,
                outline: "none",
              }}
            />
          </IGSCard>

          <IGSCard>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Dirección</div>
            <div style={{ fontSize: 11.5, color: IGS.muted, marginBottom: 14 }}>
              Aparece al pie de la carta y en el cartel imprimible.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
              <IGSInput
                label="Dirección"
                placeholder="Rivadavia 842"
                value={form.address ?? ""}
                onChange={(e) => update("address", e.target.value)}
              />
              <IGSInput
                label="Ciudad"
                placeholder="San Fernando del Valle"
                value={form.city ?? ""}
                onChange={(e) => update("city", e.target.value)}
              />
            </div>
          </IGSCard>

          <IGSCard>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Horarios</div>
            <div style={{ fontSize: 11.5, color: IGS.muted, marginBottom: 14 }}>
              Editor de horarios — próximo paso. Por ahora se muestran de ejemplo.
            </div>
            {HORARIOS.map((r, i) => (
              <div
                key={r.d}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 0",
                  borderTop: i === 0 ? "none" : `1px solid ${IGS.line}`,
                  fontSize: 13,
                  opacity: 0.7,
                }}
              >
                <span style={{ fontWeight: 500, color: r.off ? IGS.muted : IGS.ink }}>{r.d}</span>
                <span style={{ color: r.off ? IGS.muted : IGS.ink2, fontVariantNumeric: "tabular-nums" }}>
                  {r.hs}
                </span>
              </div>
            ))}
          </IGSCard>

          <IGSCard>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Redes y contacto</div>
            <div style={{ fontSize: 11.5, color: IGS.muted, marginBottom: 14 }}>
              Links que aparecen al pie de la carta.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <IGSInput
                label="Instagram"
                placeholder="@elfogon.cat"
                value={form.socials.instagram}
                onChange={(e) => updateSocial("instagram", e.target.value)}
              />
              <IGSInput
                label="Facebook"
                placeholder="/elfogoncatamarca"
                value={form.socials.facebook}
                onChange={(e) => updateSocial("facebook", e.target.value)}
              />
              <IGSInput
                label="WhatsApp"
                placeholder="+54 383 412 3456"
                value={form.socials.whatsapp}
                onChange={(e) => updateSocial("whatsapp", e.target.value)}
              />
              <IGSInput
                label="Link de reserva"
                placeholder="elfogon.com.ar/reservar"
                value={form.socials.reservation_url}
                onChange={(e) => updateSocial("reservation_url", e.target.value)}
              />
            </div>
          </IGSCard>
        </div>

        <div style={{ position: "sticky", top: 80, alignSelf: "flex-start" }}>
          <div
            style={{
              fontSize: 11,
              color: IGS.muted,
              fontWeight: 600,
              letterSpacing: 0.5,
              marginBottom: 10,
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>VISTA PREVIA · CLIENTE</span>
            {dirty && <IGSBadge tone="warn">Sin guardar</IGSBadge>}
          </div>
          <div
            style={{
              width: "100%",
              aspectRatio: "9/19.5",
              borderRadius: 22,
              background: "#161513",
              padding: 8,
              boxShadow: "0 30px 60px rgba(0,0,0,0.15)",
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: 16,
                background: IGS.bg,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: 90,
                  background: "linear-gradient(135deg, #d9a66b 0%, #b86340 100%)",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    bottom: -22,
                    left: 16,
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: IGS.ink,
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "3px solid #fff",
                  }}
                >
                  {initials}
                </div>
              </div>
              <div style={{ padding: "30px 16px 12px" }}>
                <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: -0.3 }}>{form.name || "Tu bar"}</div>
                {form.tagline && (
                  <div style={{ fontSize: 10, color: IGS.muted, marginBottom: 10 }}>{form.tagline}</div>
                )}
                {form.welcome_msg && (
                  <div
                    style={{
                      fontSize: 10.5,
                      color: IGS.ink2,
                      lineHeight: 1.5,
                      padding: 10,
                      background: "#fff",
                      borderRadius: 8,
                      border: `1px solid ${IGS.line}`,
                      marginTop: form.tagline ? 0 : 8,
                    }}
                  >
                    {form.welcome_msg}
                  </div>
                )}
                <div
                  style={{
                    marginTop: 14,
                    fontSize: 10,
                    fontWeight: 600,
                    color: IGS.muted,
                    letterSpacing: 0.5,
                    textTransform: "uppercase",
                  }}
                >
                  Entradas
                </div>
                {["Empanadas", "Humita en chala", "Tamales"].map((x, i) => (
                  <div
                    key={x}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "7px 0",
                      borderBottom: i === 2 ? "none" : `1px solid ${IGS.line}`,
                      fontSize: 11,
                    }}
                  >
                    <span>{x}</span>
                    <span style={{ fontWeight: 600 }}>{formatARS(1400)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {feedback && (
            <div
              role="status"
              style={{
                marginTop: 12,
                padding: "10px 12px",
                borderRadius: 10,
                background: feedback.ok ? "rgba(106,158,127,0.12)" : "rgba(194,78,47,0.1)",
                border: `1px solid ${feedback.ok ? "rgba(106,158,127,0.3)" : "rgba(194,78,47,0.3)"}`,
                color: feedback.ok ? "#3f7a57" : "#a3391e",
                fontSize: 12,
              }}
            >
              {feedback.msg}
            </div>
          )}

          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <IGSButton
              variant="ghost"
              size="sm"
              style={{ flex: 1 }}
              onClick={handleDiscard}
              disabled={!dirty || pending}
            >
              Descartar
            </IGSButton>
            <IGSButton
              variant="primary"
              size="sm"
              style={{ flex: 1, opacity: pending ? 0.7 : 1 }}
              onClick={handleSave}
              disabled={!dirty || pending}
            >
              {pending ? "Guardando..." : "Guardar cambios"}
            </IGSButton>
          </div>
        </div>
      </div>
    </div>
  );
}
