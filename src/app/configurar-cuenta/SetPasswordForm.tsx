"use client";
import { useState, useTransition } from "react";
import IGSLogo from "@/components/ui/IGSLogo";
import IGSButton from "@/components/ui/IGSButton";
import IGSInput from "@/components/ui/IGSInput";
import { IGS } from "@/lib/tokens";
import { setPasswordAction } from "./actions";

const ROLE_LABELS: Record<string, string> = {
  owner: "dueño/a",
  manager: "encargado/a",
  waiter: "mozo/a",
  kitchen: "cocinero/a",
  super_admin: "admin de IGS",
};

type Props = {
  email: string;
  fullName: string;
  barName: string | null;
  role: "owner" | "manager" | "waiter" | "kitchen" | "super_admin";
};

export default function SetPasswordForm({ email, fullName, barName, role }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await setPasswordAction(fd);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        background: IGS.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "var(--font-inter), system-ui, sans-serif",
        color: IGS.ink,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: "#fff",
          borderRadius: 16,
          padding: "32px 28px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.06)",
          border: `1px solid ${IGS.line}`,
        }}
      >
        <IGSLogo size={26} />

        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.6, marginTop: 24, marginBottom: 6 }}>
          ¡Bienvenido/a, {fullName}!
        </div>
        <div style={{ fontSize: 13, color: IGS.muted, marginBottom: 24, lineHeight: 1.5 }}>
          {barName ? (
            <>
              Te sumaron al equipo de <b>{barName}</b> como <b>{ROLE_LABELS[role] ?? role}</b>.
              <br />
              Configurá una contraseña para entrar.
            </>
          ) : (
            <>Configurá una contraseña para entrar al panel.</>
          )}
        </div>

        <div
          style={{
            padding: "10px 14px",
            background: IGS.bg,
            borderRadius: 10,
            fontSize: 12,
            color: IGS.ink2,
            marginBottom: 18,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ color: IGS.muted, fontSize: 11 }}>Tu email:</span>
          <span style={{ fontWeight: 600 }}>{email}</span>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              background: "rgba(194,78,47,0.1)",
              border: "1px solid rgba(194,78,47,0.3)",
              color: "#a3391e",
              fontSize: 12.5,
              marginBottom: 14,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <IGSInput
            label="Contraseña"
            name="password"
            type="password"
            placeholder="••••••••"
            required
            minLength={8}
            autoComplete="new-password"
            hint="Mínimo 8 caracteres"
            style={{ marginBottom: 14 }}
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 018 0v4" />
              </svg>
            }
          />

          <IGSInput
            label="Repetir contraseña"
            name="confirm"
            type="password"
            placeholder="••••••••"
            required
            minLength={8}
            autoComplete="new-password"
            style={{ marginBottom: 18 }}
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 018 0v4" />
              </svg>
            }
          />

          <IGSButton type="submit" size="lg" disabled={pending} style={{ width: "100%" }}>
            {pending ? "Guardando..." : "Guardar y entrar"}
          </IGSButton>
        </form>

        <div style={{ fontSize: 11, color: IGS.muted, textAlign: "center", marginTop: 20 }}>
          Después podés cambiar tu contraseña desde el panel.
        </div>
      </div>
    </div>
  );
}
