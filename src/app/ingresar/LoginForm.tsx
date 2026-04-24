"use client";
import { useState, useTransition, useEffect } from "react";
import IGSLogo from "@/components/ui/IGSLogo";
import IGSButton from "@/components/ui/IGSButton";
import IGSInput from "@/components/ui/IGSInput";
import { IGS } from "@/lib/tokens";
import { loginAction, signupAction } from "./actions";

type Mode = "login" | "signup";

export default function LoginForm({
  initialMode = "login" as Mode,
  next = "/dashboard",
  initialError = null,
}: {
  initialMode?: Mode;
  next?: string;
  initialError?: string | null;
}) {
  const [tab, setTab] = useState<Mode>(initialMode);
  const [error, setError] = useState<string | null>(initialError);
  const [pending, startTransition] = useTransition();
  const [processingInvite, setProcessingInvite] = useState(false);
  const isLogin = tab === "login";

  // Si Supabase devolvió tokens en el fragment (#access_token=...),
  // los procesamos: seteamos sesión y enviamos al callback para que
  // decida el destino según rol y password_set.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const params = new URLSearchParams(hash);
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    const errorParam = params.get("error_description") || params.get("error");

    if (errorParam) {
      setError(decodeURIComponent(errorParam.replace(/\+/g, " ")));
      window.location.hash = "";
      return;
    }

    if (access_token && refresh_token) {
      setProcessingInvite(true);
      // Limpiamos el hash de la URL antes de procesar (evita reentrar)
      const cleanUrl = window.location.pathname + window.location.search;
      window.history.replaceState(null, "", cleanUrl);
      (async () => {
        try {
          // Mandamos los tokens al server para que setee la sesión SSR.
          // Si lo hacemos client-side, las cookies no quedan en formato
          // que el middleware pueda leer.
          const res = await fetch("/auth/set-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ access_token, refresh_token }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            setProcessingInvite(false);
            setError(data?.error ?? "No pudimos validar tu invitación.");
            return;
          }
          const data = await res.json();
          window.location.replace(data.destination ?? "/dashboard");
        } catch (e) {
          setProcessingInvite(false);
          setError(e instanceof Error ? e.message : "Error procesando invitación");
        }
      })();
    }
  }, []);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("next", next);
    startTransition(async () => {
      const res = await (isLogin ? loginAction(fd) : signupAction(fd));
      if (res && "error" in res) setError(res.error);
    });
  }

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        background: IGS.bg,
        display: "flex",
        color: IGS.ink,
      }}
    >
      <div
        style={{
          width: "55%",
          display: "flex",
          flexDirection: "column",
          padding: "32px 56px",
          minHeight: "100vh",
        }}
      >
        <div>
          <IGSLogo size={26} />
        </div>

        {processingInvite ? (
          <div style={{ margin: "auto", padding: "40px 0", textAlign: "center" }}>
            <div
              style={{
                width: 48,
                height: 48,
                margin: "0 auto 18px",
                borderRadius: 24,
                border: `3px solid ${IGS.line2}`,
                borderTopColor: IGS.accent,
                animation: "spin 0.9s linear infinite",
              }}
            />
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
              Validando tu invitación…
            </div>
            <div style={{ fontSize: 12, color: IGS.muted }}>
              En un instante te llevamos a configurar tu contraseña.
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
        <form
          onSubmit={handleSubmit}
          style={{ maxWidth: 380, width: "100%", margin: "auto", padding: "40px 0" }}
        >
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.8, marginBottom: 8 }}>
            {isLogin ? "Bienvenido de vuelta" : "Creá tu bar en IGS"}
          </div>
          <div style={{ fontSize: 13, color: IGS.muted, marginBottom: 26, lineHeight: 1.5 }}>
            {isLogin
              ? "Ingresá para administrar tu carta, mesas y pedidos."
              : "Probalo gratis 14 días. Después, $30.000 ARS por mes, sin permanencia."}
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

          {!isLogin && (
            <IGSInput
              label="Nombre del bar"
              name="bar_name"
              placeholder="El Fogón"
              style={{ marginBottom: 14 }}
              required
            />
          )}

          <IGSInput
            label="Email"
            name="email"
            type="email"
            placeholder="mario@elfogon.com.ar"
            required
            autoComplete={isLogin ? "email" : "email"}
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M4 6h16v12H4z" />
                <path d="M4 7l8 6 8-6" />
              </svg>
            }
            style={{ marginBottom: 14 }}
          />

          <IGSInput
            label="Contraseña"
            name="password"
            type="password"
            placeholder="••••••••"
            required
            minLength={8}
            autoComplete={isLogin ? "current-password" : "new-password"}
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 018 0v4" />
              </svg>
            }
            style={{ marginBottom: 10 }}
          />

          {isLogin && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  fontSize: 12,
                  color: IGS.ink2,
                  cursor: "pointer",
                }}
              >
                <input type="checkbox" name="remember" defaultChecked style={{ accentColor: IGS.ink }} />
                Recordarme
              </label>
              <a href="#" style={{ fontSize: 12, color: IGS.accent, textDecoration: "none", fontWeight: 500 }}>
                Olvidé mi contraseña
              </a>
            </div>
          )}

          <IGSButton
            type="submit"
            size="lg"
            disabled={pending}
            style={{ width: "100%", marginTop: isLogin ? 0 : 10, opacity: pending ? 0.7 : 1 }}
          >
            {pending ? "..." : isLogin ? "Ingresar" : "Crear mi bar"}
          </IGSButton>

          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "22px 0" }}>
            <div style={{ flex: 1, height: 1, background: IGS.line }} />
            <span
              style={{
                fontSize: 11,
                color: IGS.muted,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              o
            </span>
            <div style={{ flex: 1, height: 1, background: IGS.line }} />
          </div>

          <IGSButton
            type="button"
            variant="ghost"
            size="lg"
            style={{ width: "100%" }}
            onClick={() =>
              alert("Google OAuth — se activa cuando configuremos el provider en Supabase.")
            }
            icon={
              <svg width="16" height="16" viewBox="0 0 48 48">
                <path
                  fill="#FFC107"
                  d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"
                />
                <path
                  fill="#FF3D00"
                  d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
                />
                <path
                  fill="#4CAF50"
                  d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
                />
                <path
                  fill="#1976D2"
                  d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C41.4 35.8 44 30.3 44 24c0-1.3-.1-2.6-.4-3.9z"
                />
              </svg>
            }
          >
            Continuar con Google
          </IGSButton>

          <div
            style={{
              fontSize: 12,
              color: IGS.muted,
              marginTop: 24,
              textAlign: "center",
            }}
          >
            {isLogin ? "¿Todavía no tenés cuenta?" : "¿Ya tenés cuenta?"}{" "}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setError(null);
                setTab(isLogin ? "signup" : "login");
              }}
              style={{ color: IGS.accent, fontWeight: 600, textDecoration: "none" }}
            >
              {isLogin ? "Creá tu bar" : "Ingresar"}
            </a>
          </div>
        </form>
        )}

        <div style={{ fontSize: 11, color: IGS.muted, marginTop: "auto" }}>
          © {new Date().getFullYear()} IGS · San Fernando del Valle, Catamarca
        </div>
      </div>

      <div
        style={{
          flex: 1,
          background: "#0f0f0e",
          color: "#fbfaf7",
          padding: "48px 56px",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
          minHeight: "100vh",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.08,
            backgroundImage:
              "radial-gradient(circle at 20% 20%, #c24e2f 0, transparent 40%), radial-gradient(circle at 80% 70%, #d9b441 0, transparent 45%)",
          }}
        />

        <div style={{ position: "relative", zIndex: 1 }}>
          <div
            style={{
              display: "inline-block",
              padding: "5px 12px",
              background: "rgba(194,78,47,0.2)",
              color: "#f5b9a4",
              borderRadius: 12,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 0.5,
              marginBottom: 28,
            }}
          >
            MENÚ DIGITAL + GESTIÓN
          </div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: -0.8,
              lineHeight: 1.15,
              marginBottom: 16,
            }}
          >
            Tu bar sin papel.
            <br />
            Pedidos sin vueltas.
          </div>
          <div
            style={{
              fontSize: 14,
              color: "rgba(255,255,255,0.65)",
              lineHeight: 1.6,
              maxWidth: 380,
            }}
          >
            Carta con QR por mesa, comanda directa a cocina por estación, control de mozos y salón en una sola plataforma.
          </div>
        </div>

        <div style={{ marginTop: "auto", position: "relative", zIndex: 1 }}>
          <div
            style={{
              padding: "18px 20px",
              background: "rgba(255,255,255,0.05)",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div
              style={{
                fontSize: 13.5,
                lineHeight: 1.5,
                color: "rgba(255,255,255,0.88)",
                fontStyle: "italic",
              }}
            >
              &ldquo;Bajamos los tiempos de espera a la mitad y ningún mozo se vuelve a perder un pedido.&rdquo;
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  background: IGS.accent,
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                VC
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>Verónica Córdoba</div>
                <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.55)" }}>Cuyen · Fiambalá</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
