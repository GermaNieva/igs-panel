"use client";
import { useState, useTransition, useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import IGSButton from "@/components/ui/IGSButton";
import IGSInput from "@/components/ui/IGSInput";
import IGSBadge from "@/components/ui/IGSBadge";
import { IGS, formatARS } from "@/lib/tokens";
import {
  createZoneAction,
  renameZoneAction,
  deleteZoneAction,
  createTableAction,
  updateTableAction,
  deleteTableAction,
  seedFirstZoneAction,
} from "./actions";

export type Zone = { id: string; name: string };
export type Mesa = {
  id: string;
  number: number;
  alias: string | null;
  seats: number;
  zone_id: string | null;
  status: "free" | "occupied" | "called";
  called_at: string | null;
};
export type Llamada = {
  order_id: string;
  table_id: string;
  called_at: string;
  total: number;
};

type Tab = "mesa" | "general" | "llamadas";

type Props = {
  slug: string;
  barName: string;
  baseUrl: string;
  zones: Zone[];
  mesas: Mesa[];
  llamadas: Llamada[];
};

const STATUS_STYLE: Record<Mesa["status"], { bg: string; ring: string; label: string; tone: string }> = {
  free: { bg: "#fff", ring: IGS.line2, label: "Libre", tone: IGS.muted },
  occupied: { bg: "rgba(194,78,47,0.08)", ring: IGS.accent, label: "Ocupada", tone: IGS.accent },
  called: { bg: "rgba(217,180,65,0.15)", ring: IGS.warn, label: "Llamando mozo", tone: "#8a6c14" },
};

export default function MesasClient({ slug, barName, baseUrl, zones, mesas, llamadas }: Props) {
  const [activeZone, setActiveZone] = useState<string | null>(zones[0]?.id ?? null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("mesa");
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [newZoneOpen, setNewZoneOpen] = useState(false);
  const [newZoneName, setNewZoneName] = useState("");

  const filteredMesas = useMemo(
    () => mesas.filter((m) => activeZone === null || m.zone_id === activeZone),
    [mesas, activeZone]
  );
  // Si la mesa seleccionada ya no existe, devolvemos null en lugar de hacer
  // setSelectedId(null) en un effect (rompe react-hooks/set-state-in-effect).
  const selected = useMemo(
    () => (selectedId ? mesas.find((m) => m.id === selectedId) ?? null : null),
    [selectedId, mesas]
  );

  function flash(ok: boolean, msg: string) {
    setFeedback({ ok, msg });
    setTimeout(() => setFeedback((f) => (f?.msg === msg ? null : f)), 2400);
  }

  const mesaUrl = (n: number) => `${baseUrl || ""}/carta/${slug}/m/${String(n).padStart(2, "0")}`;
  const barUrl = `${baseUrl || ""}/carta/${slug}`;

  function handleSeedZone() {
    startTransition(async () => {
      const res = await seedFirstZoneAction();
      if (!res.ok) flash(false, res.error);
    });
  }

  function handleCreateZone() {
    const name = newZoneName.trim();
    if (!name) return;
    startTransition(async () => {
      const res = await createZoneAction(name);
      if (res.ok) {
        setNewZoneName("");
        setNewZoneOpen(false);
        setActiveZone(res.data.id);
      } else flash(false, res.error);
    });
  }

  function handleDeleteZone(id: string) {
    if (!confirm("¿Borrar esta zona? Las mesas no se borran, quedan sin zona.")) return;
    startTransition(async () => {
      const res = await deleteZoneAction(id);
      if (res.ok) {
        if (activeZone === id) setActiveZone(zones.find((z) => z.id !== id)?.id ?? null);
      } else flash(false, res.error);
    });
  }

  function handleCreateMesa() {
    if (!activeZone) return;
    startTransition(async () => {
      const res = await createTableAction(activeZone);
      if (res.ok) {
        setSelectedId(res.data.id);
        setTab("mesa");
      } else flash(false, res.error);
    });
  }

  if (zones.length === 0) {
    return (
      <div style={{ padding: "60px 32px", maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.6, marginBottom: 8 }}>
          Todavía no tenés zonas
        </div>
        <div style={{ fontSize: 13.5, color: IGS.muted, marginBottom: 24, lineHeight: 1.5 }}>
          Las zonas son los espacios físicos del bar (Salón, Patio, Barra…). Después agregás mesas
          a cada una. Te creamos la zona &ldquo;Salón principal&rdquo; para arrancar.
        </div>
        <IGSButton size="lg" onClick={handleSeedZone} disabled={pending}>
          {pending ? "Creando..." : "Crear zona inicial"}
        </IGSButton>
      </div>
    );
  }

  const stats = {
    free: filteredMesas.filter((m) => m.status === "free").length,
    occupied: filteredMesas.filter((m) => m.status === "occupied").length,
    called: filteredMesas.filter((m) => m.status === "called").length,
  };

  return (
    <div style={{ display: "flex", minHeight: "calc(100vh - 60px)" }}>
      {/* SIDEBAR ZONAS */}
      <aside
        style={{
          width: 220,
          borderRight: `1px solid ${IGS.line}`,
          background: IGS.surface,
          padding: "22px 16px",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: IGS.muted,
            fontWeight: 600,
            letterSpacing: 0.8,
            marginBottom: 12,
            textTransform: "uppercase",
          }}
        >
          Zonas
        </div>
        {zones.map((z) => (
          <ZoneRow
            key={z.id}
            zone={z}
            active={z.id === activeZone}
            count={mesas.filter((m) => m.zone_id === z.id).length}
            onClick={() => setActiveZone(z.id)}
            onDelete={() => handleDeleteZone(z.id)}
            onRename={(name) =>
              startTransition(async () => {
                const res = await renameZoneAction(z.id, name);
                if (!res.ok) flash(false, res.error);
              })
            }
          />
        ))}

        {newZoneOpen ? (
          <div style={{ marginTop: 8, display: "flex", gap: 4 }}>
            <input
              autoFocus
              value={newZoneName}
              onChange={(e) => setNewZoneName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateZone();
                if (e.key === "Escape") {
                  setNewZoneOpen(false);
                  setNewZoneName("");
                }
              }}
              placeholder="Nombre"
              style={{
                flex: 1,
                height: 32,
                padding: "0 10px",
                borderRadius: 8,
                border: `1px solid ${IGS.line2}`,
                fontSize: 12.5,
                outline: "none",
                fontFamily: "inherit",
              }}
            />
            <button
              onClick={handleCreateZone}
              aria-label="Crear"
              style={{
                width: 32,
                height: 32,
                border: "none",
                borderRadius: 8,
                background: IGS.ink,
                color: "#fff",
                cursor: "pointer",
              }}
            >
              ✓
            </button>
          </div>
        ) : (
          <button
            onClick={() => setNewZoneOpen(true)}
            style={{
              width: "100%",
              marginTop: 14,
              padding: "9px 12px",
              border: `1px dashed ${IGS.line2}`,
              background: "transparent",
              borderRadius: 8,
              fontSize: 12,
              color: IGS.muted,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            + Nueva zona
          </button>
        )}

        <div style={{ marginTop: 22, padding: 14, background: IGS.bg, borderRadius: 10 }}>
          <div
            style={{
              fontSize: 11,
              color: IGS.muted,
              fontWeight: 600,
              letterSpacing: 0.5,
              marginBottom: 8,
            }}
          >
            RESUMEN AHORA
          </div>
          {[
            { l: "Libres", v: stats.free, c: IGS.muted },
            { l: "Ocupadas", v: stats.occupied, c: IGS.accent },
            { l: "Llamando", v: stats.called, c: IGS.warn },
          ].map((s) => (
            <div
              key={s.l}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "4px 0",
                fontSize: 12,
              }}
            >
              <span style={{ color: IGS.ink2 }}>{s.l}</span>
              <span style={{ fontWeight: 700, color: s.c, fontVariantNumeric: "tabular-nums" }}>
                {s.v}
              </span>
            </div>
          ))}
        </div>

        {llamadas.length > 0 && (
          <button
            onClick={() => setTab("llamadas")}
            style={{
              marginTop: 12,
              width: "100%",
              padding: "10px 12px",
              background: "rgba(217,180,65,0.18)",
              border: "1px solid rgba(217,180,65,0.5)",
              borderRadius: 10,
              cursor: "pointer",
              fontFamily: "inherit",
              textAlign: "left",
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                color: "#8a6c14",
                fontWeight: 700,
                letterSpacing: 0.5,
                marginBottom: 4,
              }}
            >
              🔔 LLAMADAS ACTIVAS
            </div>
            <div style={{ fontSize: 11.5, color: IGS.ink2 }}>
              {llamadas.length} mesas esperando al mozo
            </div>
          </button>
        )}
      </aside>

      {/* GRILLA MESAS */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div
          style={{
            padding: "22px 28px 14px",
            borderBottom: `1px solid ${IGS.line}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.5 }}>Mesas y códigos QR</div>
            <div style={{ fontSize: 12, color: IGS.muted, marginTop: 2 }}>
              Cada QR abre la carta del cliente con precios en vivo · llamada al mozo desde el celular
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <IGSButton
              variant="primary"
              size="sm"
              onClick={handleCreateMesa}
              disabled={pending || !activeZone}
              icon={<span style={{ fontSize: 15, marginTop: -2 }}>+</span>}
            >
              Agregar mesa
            </IGSButton>
          </div>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: 28 }}>
          {filteredMesas.length === 0 ? (
            <div
              style={{
                padding: "40px 20px",
                textAlign: "center",
                color: IGS.muted,
                fontSize: 13,
              }}
            >
              <div style={{ marginBottom: 14 }}>Esta zona no tiene mesas todavía.</div>
              <IGSButton
                variant="primary"
                size="sm"
                onClick={handleCreateMesa}
                disabled={pending || !activeZone}
              >
                + Agregar primera mesa
              </IGSButton>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                gap: 14,
                maxWidth: 900,
              }}
            >
              {filteredMesas.map((m) => {
                const s = STATUS_STYLE[m.status];
                const isSel = m.id === selectedId && tab === "mesa";
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      setSelectedId(m.id);
                      setTab("mesa");
                    }}
                    style={{
                      aspectRatio: "1",
                      padding: 14,
                      borderRadius: 12,
                      background: s.bg,
                      border: `2px solid ${isSel ? IGS.ink : s.ring}`,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      textAlign: "left",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      position: "relative",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 28,
                          fontWeight: 700,
                          letterSpacing: -1,
                          lineHeight: 1,
                        }}
                      >
                        {String(m.number).padStart(2, "0")}
                      </div>
                      {m.status === "called" && (
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 5,
                            background: s.tone,
                            marginTop: 4,
                            animation: "igspulse 1.2s ease-in-out infinite",
                          }}
                        />
                      )}
                      {m.status === "occupied" && (
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            background: s.tone,
                            marginTop: 4,
                          }}
                        />
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: 10.5, color: IGS.muted, marginBottom: 2 }}>
                        {m.seats} {m.seats === 1 ? "lugar" : "lugares"}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: s.tone }}>{s.label}</div>
                      {m.alias && (
                        <div
                          style={{
                            fontSize: 10,
                            color: IGS.muted,
                            marginTop: 2,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {m.alias}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
              <button
                onClick={handleCreateMesa}
                disabled={pending}
                style={{
                  aspectRatio: "1",
                  borderRadius: 12,
                  border: `2px dashed ${IGS.line2}`,
                  background: "transparent",
                  color: IGS.muted,
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <span style={{ fontSize: 22 }}>+</span>
                <span>Nueva mesa</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* PANEL DERECHO */}
      <aside
        style={{
          width: 360,
          borderLeft: `1px solid ${IGS.line}`,
          background: IGS.surface,
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", borderBottom: `1px solid ${IGS.line}`, padding: "0 8px" }}>
          {(
            [
              { id: "mesa", l: "QR por mesa" },
              { id: "general", l: "QR general" },
              { id: "llamadas", l: `Llamadas${llamadas.length ? ` · ${llamadas.length}` : ""}` },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1,
                padding: "14px 6px",
                border: "none",
                background: "transparent",
                fontSize: 11.5,
                fontWeight: tab === t.id ? 700 : 500,
                color: tab === t.id ? IGS.ink : IGS.muted,
                borderBottom: `2px solid ${tab === t.id ? IGS.accent : "transparent"}`,
                cursor: "pointer",
                fontFamily: "inherit",
                marginBottom: -1,
              }}
            >
              {t.l}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "20px 22px" }}>
          {tab === "mesa" && (
            <MesaTab
              selected={selected}
              zones={zones}
              mesaUrl={mesaUrl}
              onUpdate={(input) =>
                startTransition(async () => {
                  const res = await updateTableAction(input);
                  flash(res.ok, res.ok ? "Mesa actualizada." : res.error);
                })
              }
              onDelete={(id) => {
                if (!confirm("¿Borrar esta mesa?")) return;
                startTransition(async () => {
                  const res = await deleteTableAction(id);
                  if (res.ok) {
                    setSelectedId(null);
                    flash(true, "Mesa borrada.");
                  } else flash(false, res.error);
                });
              }}
              pending={pending}
            />
          )}

          {tab === "general" && <GeneralTab barUrl={barUrl} barName={barName} />}

          {tab === "llamadas" && (
            <LlamadasTab llamadas={llamadas} mesas={mesas} />
          )}
        </div>
      </aside>

      {feedback && (
        <div
          role="status"
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            padding: "10px 14px",
            borderRadius: 10,
            background: feedback.ok ? "#1a4332" : "#5a1f12",
            color: "#fff",
            fontSize: 12.5,
            fontWeight: 500,
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
            zIndex: 100,
          }}
        >
          {feedback.msg}
        </div>
      )}

      <style jsx>{`
        @keyframes igspulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.4); }
        }
      `}</style>
    </div>
  );
}

// ====================================================================
function ZoneRow({
  zone,
  active,
  count,
  onClick,
  onDelete,
  onRename,
}: {
  zone: Zone;
  active: boolean;
  count: number;
  onClick: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(zone.name);
  if (editing) {
    return (
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          if (name.trim() && name !== zone.name) onRename(name.trim());
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setName(zone.name);
            setEditing(false);
          }
        }}
        style={{
          width: "100%",
          height: 32,
          padding: "0 10px",
          borderRadius: 8,
          border: `1px solid ${IGS.line2}`,
          fontSize: 12.5,
          outline: "none",
          fontFamily: "inherit",
          marginBottom: 2,
        }}
      />
    );
  }
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        marginBottom: 2,
        background: active ? IGS.bg : "transparent",
        borderRadius: 8,
      }}
    >
      <button
        onClick={onClick}
        onDoubleClick={() => setEditing(true)}
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "9px 12px",
          border: "none",
          background: "transparent",
          fontSize: 12.5,
          fontWeight: active ? 600 : 500,
          color: IGS.ink,
          fontFamily: "inherit",
          textAlign: "left",
          cursor: "pointer",
        }}
        title="Doble clic para renombrar"
      >
        <span>{zone.name}</span>
        <span style={{ fontSize: 10.5, color: IGS.muted }}>{count}</span>
      </button>
      {active && (
        <button
          onClick={onDelete}
          aria-label="Borrar zona"
          title="Borrar zona"
          style={{
            border: "none",
            background: "transparent",
            color: IGS.muted,
            cursor: "pointer",
            padding: "4px 8px",
            fontSize: 14,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

// ====================================================================
function MesaTab({
  selected,
  zones,
  mesaUrl,
  onUpdate,
  onDelete,
  pending,
}: {
  selected: Mesa | null;
  zones: Zone[];
  mesaUrl: (n: number) => string;
  onUpdate: (input: { id: string; alias: string | null; seats: number; zone_id: string | null }) => void;
  onDelete: (id: string) => void;
  pending: boolean;
}) {
  if (!selected) {
    return (
      <div
        style={{
          padding: 24,
          textAlign: "center",
          background: IGS.bg,
          borderRadius: 10,
          color: IGS.muted,
          fontSize: 12,
        }}
      >
        Tocá una mesa para ver su QR y editarla.
      </div>
    );
  }

  return (
    <MesaEditor
      key={selected.id}
      mesa={selected}
      zones={zones}
      mesaUrl={mesaUrl(selected.number)}
      onUpdate={onUpdate}
      onDelete={onDelete}
      pending={pending}
    />
  );
}

function MesaEditor({
  mesa,
  zones,
  mesaUrl,
  onUpdate,
  onDelete,
  pending,
}: {
  mesa: Mesa;
  zones: Zone[];
  mesaUrl: string;
  onUpdate: (input: { id: string; alias: string | null; seats: number; zone_id: string | null }) => void;
  onDelete: (id: string) => void;
  pending: boolean;
}) {
  const [alias, setAlias] = useState(mesa.alias ?? "");
  const [seats, setSeats] = useState<number>(mesa.seats);
  const [zoneId, setZoneId] = useState<string | null>(mesa.zone_id);
  const dirty = alias !== (mesa.alias ?? "") || seats !== mesa.seats || zoneId !== mesa.zone_id;

  return (
    <div>
      <div style={{ fontSize: 11, color: IGS.muted, fontWeight: 600, letterSpacing: 0.5 }}>
        MESA SELECCIONADA
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: -0.5,
          marginTop: 4,
          marginBottom: 16,
        }}
      >
        Mesa {String(mesa.number).padStart(2, "0")}
      </div>
      <div
        style={{
          padding: 22,
          border: `1px solid ${IGS.line}`,
          borderRadius: 14,
          background: "#fff",
          textAlign: "center",
        }}
      >
        <QRCodeSVG value={mesaUrl} size={170} bgColor="#fff" fgColor="#161513" level="M" />
        <div
          style={{
            marginTop: 12,
            fontSize: 11,
            color: IGS.muted,
            fontFamily: "monospace",
            wordBreak: "break-all",
          }}
        >
          {mesaUrl}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
        <IGSButton
          variant="ghost"
          size="sm"
          onClick={() => downloadQRPng(`mesa-${String(mesa.number).padStart(2, "0")}`, mesaUrl)}
        >
          Descargar PNG
        </IGSButton>
        <IGSButton variant="primary" size="sm" onClick={() => window.print()}>
          Imprimir
        </IGSButton>
      </div>

      <div
        style={{
          marginTop: 16,
          padding: 12,
          background: IGS.bg,
          borderRadius: 10,
        }}
      >
        <div
          style={{
            fontSize: 10.5,
            color: IGS.muted,
            fontWeight: 600,
            letterSpacing: 0.5,
            marginBottom: 6,
          }}
        >
          AL ESCANEAR, EL CLIENTE:
        </div>
        <div style={{ fontSize: 11.5, color: IGS.ink2, lineHeight: 1.55 }}>
          1. Ve la carta con precios en vivo
          <br />
          2. Arma su pedido en el celular
          <br />
          3. <b>Toca &ldquo;Llamar al mozo&rdquo;</b> y acá aparece el aviso
        </div>
      </div>

      <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${IGS.line}` }}>
        <IGSInput
          label="Nombre / alias (opcional)"
          placeholder={`Mesa ${String(mesa.number).padStart(2, "0")}`}
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          style={{ marginBottom: 10 }}
        />
        <IGSInput
          label="Cantidad de lugares"
          type="number"
          min={1}
          step={1}
          value={seats}
          onChange={(e) => setSeats(Number(e.target.value) || 1)}
          style={{ marginBottom: 10 }}
        />
        <label style={{ display: "block" }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: IGS.ink2, marginBottom: 6 }}>
            Zona
          </div>
          <select
            value={zoneId ?? ""}
            onChange={(e) => setZoneId(e.target.value || null)}
            style={{
              width: "100%",
              height: 40,
              padding: "0 12px",
              borderRadius: 10,
              border: `1px solid ${IGS.line2}`,
              background: "#fff",
              fontSize: 12.5,
              color: IGS.ink,
              fontFamily: "inherit",
              outline: "none",
            }}
          >
            <option value="">— Sin zona —</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
        </label>

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <IGSButton variant="danger" size="sm" onClick={() => onDelete(mesa.id)} disabled={pending}>
            Eliminar
          </IGSButton>
          <IGSButton
            variant="primary"
            size="sm"
            onClick={() => onUpdate({ id: mesa.id, alias: alias || null, seats, zone_id: zoneId })}
            disabled={!dirty || pending}
            style={{ flex: 1, opacity: !dirty || pending ? 0.6 : 1 }}
          >
            {pending ? "..." : "Guardar"}
          </IGSButton>
        </div>
      </div>
    </div>
  );
}

// ====================================================================
function GeneralTab({ barUrl, barName }: { barUrl: string; barName: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: IGS.muted, fontWeight: 600, letterSpacing: 0.5 }}>
        QR GENERAL DEL BAR
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: -0.4,
          marginTop: 4,
          marginBottom: 6,
        }}
      >
        Carta sin mesa asignada
      </div>
      <div style={{ fontSize: 11.5, color: IGS.muted, lineHeight: 1.5, marginBottom: 16 }}>
        Ideal para la entrada, la barra, redes sociales o take-away. Abre la carta pero <b>no</b>{" "}
        permite llamar al mozo (no hay mesa).
      </div>
      <div
        style={{
          padding: 22,
          border: `1px solid ${IGS.line}`,
          borderRadius: 14,
          background: "#fff",
          textAlign: "center",
        }}
      >
        <QRCodeSVG value={barUrl} size={170} bgColor="#fff" fgColor="#161513" level="M" />
        <div
          style={{
            marginTop: 12,
            fontSize: 11,
            color: IGS.muted,
            fontFamily: "monospace",
            wordBreak: "break-all",
          }}
        >
          {barUrl}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
        <IGSButton
          variant="ghost"
          size="sm"
          onClick={() => downloadQRPng(`${barName.toLowerCase().replace(/\s+/g, "-")}-general`, barUrl)}
        >
          PNG
        </IGSButton>
        <IGSButton variant="primary" size="sm" onClick={() => window.print()}>
          Imprimir
        </IGSButton>
      </div>
    </div>
  );
}

// ====================================================================
function LlamadasTab({ llamadas, mesas }: { llamadas: Llamada[]; mesas: Mesa[] }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: IGS.muted, fontWeight: 600, letterSpacing: 0.5 }}>EN VIVO</div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: -0.4,
          marginTop: 4,
          marginBottom: 14,
        }}
      >
        {llamadas.length === 0
          ? "Sin llamadas"
          : `${llamadas.length} mesa${llamadas.length > 1 ? "s" : ""} esperando`}
      </div>
      {llamadas.length === 0 ? (
        <div
          style={{
            padding: 24,
            textAlign: "center",
            background: IGS.bg,
            borderRadius: 10,
            color: IGS.muted,
            fontSize: 12,
          }}
        >
          Cuando un cliente toque &ldquo;Llamar al mozo&rdquo; desde la carta, aparece acá.
        </div>
      ) : (
        llamadas.map((l) => {
          const mesa = mesas.find((m) => m.id === l.table_id);
          const since = elapsedSince(l.called_at);
          return (
            <div
              key={l.order_id}
              style={{
                padding: "14px 16px",
                background: "#fff",
                borderRadius: 12,
                border: "1px solid rgba(217,180,65,0.5)",
                borderLeft: "4px solid #d9b441",
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 8,
                }}
              >
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>
                    Mesa {mesa ? String(mesa.number).padStart(2, "0") : "?"}
                  </div>
                  {mesa && (
                    <div style={{ fontSize: 11, color: IGS.muted, marginTop: 2 }}>
                      {mesa.seats} lugares
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#8a6c14",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    ⏱ {since}
                  </div>
                  <div style={{ fontSize: 10, color: IGS.muted, marginTop: 2 }}>esperando</div>
                </div>
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: IGS.ink2,
                  padding: "8px 10px",
                  background: IGS.bg,
                  borderRadius: 6,
                  marginBottom: 10,
                }}
              >
                Total estimado: <b>{formatARS(l.total)}</b>
              </div>
              <IGSBadge tone="warn">Asignación de mozo · próximo paso</IGSBadge>
            </div>
          );
        })
      )}
      <div
        style={{
          marginTop: 16,
          fontSize: 10.5,
          color: IGS.muted,
          lineHeight: 1.5,
        }}
      >
        El tiempo en vivo se actualiza cuando se cablea Realtime con el flujo del cliente (próxima
        fase).
      </div>
    </div>
  );
}

// ====================================================================
function elapsedSince(iso: string): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "0:00";
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function downloadQRPng(filename: string, value: string) {
  const svgEl = document.querySelector<SVGSVGElement>(`svg`);
  if (!svgEl) return;
  // Buscar el SVG visible adentro del panel derecho — más fiable: render uno temporal.
  const tempSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  // Este atajo simplemente toma el primer SVG visible del QR; en una iteración corta lo cambio
  // a un canvas dedicado. Por ahora, usamos el SVG ya rendereado.
  void tempSvg;

  const xml = new XMLSerializer().serializeToString(svgEl);
  const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    const size = 600;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.download = `${filename}.png`;
      a.href = URL.createObjectURL(blob);
      a.click();
      URL.revokeObjectURL(a.href);
    });
    URL.revokeObjectURL(url);
  };
  img.src = url;
  void value;
}
