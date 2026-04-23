"use client";
import { useState, useTransition } from "react";
import IGSCard from "@/components/ui/IGSCard";
import IGSBadge from "@/components/ui/IGSBadge";
import IGSButton from "@/components/ui/IGSButton";
import IGSInput from "@/components/ui/IGSInput";
import { IGS } from "@/lib/tokens";
import {
  inviteStaffAction,
  updateStaffRoleAction,
  toggleStaffActiveAction,
  removeStaffAction,
  type Role,
} from "./actions";

export type StaffMember = {
  id: string;
  name: string;
  email: string;
  role: Role | "super_admin";
  active: boolean;
  last_seen: string | null;
};

const ROLE_STYLE: Record<string, { bg: string; fg: string; icon: string; label: string }> = {
  owner:       { bg: "rgba(22,21,19,0.08)", fg: "#161513", icon: "★", label: "Dueño" },
  manager:     { bg: "rgba(138,107,176,0.12)", fg: "#5d3e8a", icon: "◆", label: "Encargado" },
  waiter:      { bg: "rgba(106,158,127,0.14)", fg: "#3f7a57", icon: "●", label: "Mozo" },
  kitchen:     { bg: "rgba(194,78,47,0.12)", fg: "#a3391e", icon: "▲", label: "Cocina" },
  super_admin: { bg: "rgba(0,0,0,0.85)", fg: "#fff", icon: "⚡", label: "Super-admin IGS" },
};

const ROLE_DESCRIPTION: Record<Role, string> = {
  owner: "Acceso completo al panel y suscripción",
  manager: "Gestiona salón y ve reportes",
  waiter: "Recibe llamadas y envía a cocina",
  kitchen: "Ve el KDS y marca platos listos",
};

type Props = {
  currentUserId: string;
  currentUserRole: "owner" | "manager" | "super_admin";
  staff: StaffMember[];
};

export default function EquipoClient({ currentUserId, currentUserRole, staff }: Props) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  function flash(ok: boolean, msg: string) {
    setFeedback({ ok, msg });
    setTimeout(() => setFeedback((f) => (f?.msg === msg ? null : f)), 3500);
  }

  function handleChangeRole(id: string, role: Role) {
    startTransition(async () => {
      const res = await updateStaffRoleAction(id, role);
      flash(res.ok, res.ok ? "Rol actualizado." : res.error);
    });
  }

  function handleToggleActive(id: string, active: boolean) {
    startTransition(async () => {
      const res = await toggleStaffActiveAction(id, active);
      flash(res.ok, res.ok ? (active ? "Activado." : "Desactivado.") : res.error);
    });
  }

  function handleRemove(id: string, name: string) {
    if (!confirm(`¿Eliminar a ${name}? Pierde acceso al instante y no se puede deshacer.`)) return;
    startTransition(async () => {
      const res = await removeStaffAction(id);
      flash(res.ok, res.ok ? "Persona eliminada." : res.error);
    });
  }

  const counts = {
    owner: staff.filter((s) => s.role === "owner").length,
    manager: staff.filter((s) => s.role === "manager").length,
    waiter: staff.filter((s) => s.role === "waiter").length,
    kitchen: staff.filter((s) => s.role === "kitchen").length,
  };
  const activeCount = staff.filter((s) => s.active).length;
  const inactiveCount = staff.length - activeCount;

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1200 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.6 }}>Equipo</div>
          <div style={{ fontSize: 12.5, color: IGS.muted, marginTop: 4 }}>
            {staff.length} {staff.length === 1 ? "persona" : "personas"} · definí qué puede hacer
            cada una
          </div>
        </div>
        <IGSButton
          variant="primary"
          size="sm"
          onClick={() => setInviteOpen(true)}
          icon={<span style={{ fontSize: 15, marginTop: -2 }}>+</span>}
        >
          Invitar persona
        </IGSButton>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {(
          [
            { key: "owner", role: "Dueño / Admin", count: counts.owner, desc: ROLE_DESCRIPTION.owner, perms: ["Todo"] },
            { key: "manager", role: "Encargado", count: counts.manager, desc: ROLE_DESCRIPTION.manager, perms: ["Salón", "Mesas", "Reportes"] },
            { key: "waiter", role: "Mozo", count: counts.waiter, desc: ROLE_DESCRIPTION.waiter, perms: ["Pedidos", "Mesas"] },
            { key: "kitchen", role: "Cocina", count: counts.kitchen, desc: ROLE_DESCRIPTION.kitchen, perms: ["KDS"] },
          ] as const
        ).map((r) => (
          <IGSCard key={r.key} padding={16}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: -0.2 }}>{r.role}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: IGS.ink, fontVariantNumeric: "tabular-nums" }}>
                {r.count}
              </div>
            </div>
            <div style={{ fontSize: 11.5, color: IGS.muted, lineHeight: 1.45, marginBottom: 10 }}>{r.desc}</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {r.perms.map((p) => (
                <IGSBadge key={p}>{p}</IGSBadge>
              ))}
            </div>
          </IGSCard>
        ))}
      </div>

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
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>Todas las personas</div>
          <div style={{ display: "flex", gap: 6 }}>
            <IGSBadge tone="ok">{activeCount} activos</IGSBadge>
            {inactiveCount > 0 && <IGSBadge>{inactiveCount} inactivos</IGSBadge>}
          </div>
        </div>
        {staff.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: IGS.muted, fontSize: 13 }}>
            Todavía no hay nadie. Tocá <b>Invitar persona</b> para sumar a tu equipo.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: IGS.bg }}>
                {["Persona", "Rol", "Estado", ""].map((h, i) => (
                  <th
                    key={i}
                    style={{
                      textAlign: "left",
                      padding: "10px 16px",
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
              {staff.map((p) => {
                const r = ROLE_STYLE[p.role] ?? ROLE_STYLE.owner;
                const initials = p.name
                  .split(" ")
                  .map((x) => x[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join("");
                const isMe = p.id === currentUserId;
                const canModify =
                  !isMe && (currentUserRole === "owner" || currentUserRole === "super_admin" || (currentUserRole === "manager" && p.role !== "owner"));

                return (
                  <tr key={p.id} style={{ borderTop: `1px solid ${IGS.line}` }}>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            background: IGS.bg,
                            color: IGS.ink,
                            fontSize: 12,
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {initials}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>
                            {p.name} {isMe && <span style={{ color: IGS.muted, fontWeight: 400 }}>(vos)</span>}
                          </div>
                          <div style={{ fontSize: 11, color: IGS.muted }}>{p.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      {canModify && p.role !== "super_admin" ? (
                        <select
                          value={p.role}
                          onChange={(e) => handleChangeRole(p.id, e.target.value as Role)}
                          disabled={pending}
                          style={{
                            background: r.bg,
                            color: r.fg,
                            border: "none",
                            padding: "5px 22px 5px 9px",
                            borderRadius: 10,
                            fontSize: 11.5,
                            fontWeight: 600,
                            fontFamily: "inherit",
                            cursor: "pointer",
                            outline: "none",
                            appearance: "none",
                            backgroundImage:
                              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='8' height='5' viewBox='0 0 8 5'><path d='M0 0l4 5 4-5z' fill='%238c897f'/></svg>\")",
                            backgroundRepeat: "no-repeat",
                            backgroundPosition: "right 8px center",
                          }}
                        >
                          <option value="owner">★ Dueño</option>
                          <option value="manager">◆ Encargado</option>
                          <option value="waiter">● Mozo</option>
                          <option value="kitchen">▲ Cocina</option>
                        </select>
                      ) : (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "3px 9px",
                            borderRadius: 10,
                            background: r.bg,
                            color: r.fg,
                            fontSize: 11.5,
                            fontWeight: 600,
                          }}
                        >
                          <span>{r.icon}</span>
                          {r.label}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <button
                        aria-label="Activar / desactivar"
                        onClick={() => handleToggleActive(p.id, !p.active)}
                        disabled={isMe || pending}
                        style={{
                          width: 34,
                          height: 20,
                          borderRadius: 10,
                          border: "none",
                          cursor: isMe ? "not-allowed" : "pointer",
                          opacity: isMe ? 0.5 : 1,
                          background: p.active ? IGS.ok : IGS.line2,
                          position: "relative",
                          padding: 0,
                          marginRight: 8,
                        }}
                      >
                        <span
                          style={{
                            position: "absolute",
                            top: 2,
                            left: p.active ? 16 : 2,
                            width: 16,
                            height: 16,
                            borderRadius: 8,
                            background: "#fff",
                            transition: "left 0.15s",
                          }}
                        />
                      </button>
                      <span style={{ fontSize: 11, color: p.active ? IGS.ok : IGS.muted }}>
                        {p.active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "right" }}>
                      {canModify && (
                        <button
                          onClick={() => handleRemove(p.id, p.name)}
                          disabled={pending}
                          style={{
                            border: "none",
                            background: "transparent",
                            color: IGS.danger,
                            cursor: "pointer",
                            padding: "4px 8px",
                            fontSize: 12,
                            fontWeight: 500,
                          }}
                          title="Eliminar"
                        >
                          Eliminar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </IGSCard>

      {inviteOpen && (
        <InviteModal
          currentUserRole={currentUserRole}
          onClose={() => setInviteOpen(false)}
          onInvite={async (input) => {
            const res = await inviteStaffAction(input);
            flash(res.ok, res.ok ? `Invitación enviada a ${input.email}.` : res.error);
            return res.ok;
          }}
        />
      )}

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
            maxWidth: 360,
          }}
        >
          {feedback.msg}
        </div>
      )}
    </div>
  );
}

// ====================================================================
function InviteModal({
  currentUserRole,
  onClose,
  onInvite,
}: {
  currentUserRole: "owner" | "manager" | "super_admin";
  onClose: () => void;
  onInvite: (input: { email: string; full_name: string; role: Role }) => Promise<boolean>;
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role>("waiter");
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const ok = await onInvite({ email, full_name: fullName, role });
      if (ok) onClose();
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,15,14,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 440,
          maxWidth: "calc(100% - 40px)",
          background: "#fff",
          borderRadius: 14,
          padding: 24,
          boxShadow: "0 24px 60px rgba(0,0,0,0.25)",
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.4, marginBottom: 4 }}>
          Invitar persona al equipo
        </div>
        <div style={{ fontSize: 12.5, color: IGS.muted, marginBottom: 18 }}>
          Le mandamos un email con un link para que cree su contraseña y entre.
        </div>

        <IGSInput
          label="Nombre completo"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Ej: Ramiro Quiroga"
          required
          style={{ marginBottom: 12 }}
        />
        <IGSInput
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ramiro@elfogon.com.ar"
          required
          style={{ marginBottom: 14 }}
        />

        <div style={{ fontSize: 11.5, fontWeight: 600, color: IGS.ink2, marginBottom: 8 }}>Rol</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 }}>
          {(["owner", "manager", "waiter", "kitchen"] as const).map((r) => {
            const allowed =
              r !== "owner" || currentUserRole === "owner" || currentUserRole === "super_admin";
            const sel = role === r;
            return (
              <label
                key={r}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  border: `1px solid ${sel ? IGS.ink : IGS.line}`,
                  borderRadius: 10,
                  cursor: allowed ? "pointer" : "not-allowed",
                  opacity: allowed ? 1 : 0.5,
                  background: sel ? IGS.bg : "transparent",
                }}
              >
                <input
                  type="radio"
                  name="role"
                  value={r}
                  checked={sel}
                  disabled={!allowed}
                  onChange={() => setRole(r)}
                  style={{ accentColor: IGS.ink }}
                />
                <span style={{ fontSize: 12.5, fontWeight: 600, marginRight: "auto" }}>
                  {ROLE_STYLE[r].icon} {ROLE_STYLE[r].label}
                </span>
                <span style={{ fontSize: 11, color: IGS.muted }}>{ROLE_DESCRIPTION[r]}</span>
              </label>
            );
          })}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <IGSButton variant="ghost" size="sm" type="button" onClick={onClose} disabled={pending}>
            Cancelar
          </IGSButton>
          <IGSButton variant="primary" size="sm" type="submit" disabled={pending}>
            {pending ? "Enviando..." : "Enviar invitación"}
          </IGSButton>
        </div>
      </form>
    </div>
  );
}
