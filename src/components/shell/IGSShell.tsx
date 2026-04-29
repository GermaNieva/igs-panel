"use client";
import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import IGSLogo from "@/components/ui/IGSLogo";
import LogoutButton from "@/components/shell/LogoutButton";
import LegalFooter from "@/components/LegalFooter";
import { IGS } from "@/lib/tokens";

type NavItem = { id: string; href: string; label: string; icon: string };

const NAV: NavItem[] = [
  { id: "home",   href: "/dashboard", label: "Dashboard",   icon: "M3 12l9-9 9 9M5 10v10h14V10" },
  { id: "carta",  href: "/carta",     label: "Carta",       icon: "M4 4h12a4 4 0 014 4v12H8a4 4 0 01-4-4V4z M4 4l4 4 M8 8v12" },
  { id: "mesas",  href: "/mesas",     label: "Mesas y QR",  icon: "M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z" },
  { id: "mozo",   href: "/mozo",      label: "Vista mozo",  icon: "M12 14l9-5-9-5-9 5 9 5z M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z M12 14v7" },
  { id: "staff",  href: "/equipo",    label: "Equipo",      icon: "M8 11a4 4 0 100-8 4 4 0 000 8z M2 21a6 6 0 0112 0 M16 11a3 3 0 100-6 3 3 0 000 6z M15 21h6v-1a5 5 0 00-7-4.6" },
  { id: "config", href: "/mi-bar",    label: "Mi bar",      icon: "M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" },
  { id: "plan",   href: "/suscripcion", label: "Suscripción", icon: "M3 10h18 M5 6h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z M7 15h3" },
];

function NavIcon({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

type Props = {
  bar?: { name: string; owner: string; initials?: string };
  children: ReactNode;
  hideSidebar?: boolean;
};

export default function IGSShell({ bar, children, hideSidebar = false }: Props) {
  const pathname = usePathname();
  const owner = bar?.owner ?? "Mario R.";
  const barName = bar?.name ?? "El Fogón";
  const initials = bar?.initials ?? owner.split(" ").map(s => s[0]).join("").slice(0, 2).toUpperCase();

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
      {!hideSidebar && (
        <aside
          style={{
            width: 220,
            background: "#0f0f0e",
            color: "#fbfaf7",
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
            minHeight: "100vh",
            position: "sticky",
            top: 0,
          }}
        >
          <div style={{ padding: "20px 20px 24px" }}>
            <IGSLogo size={24} inverted />
            <div
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,0.4)",
                marginTop: 2,
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              Panel del bar
            </div>
          </div>

          <nav style={{ padding: "0 12px", flex: 1 }}>
            {NAV.map((n) => {
              const isActive =
                pathname === n.href || (n.href !== "/dashboard" && pathname?.startsWith(n.href));
              return (
                <Link
                  key={n.id}
                  href={n.href}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 11,
                    padding: "9px 12px",
                    borderRadius: 8,
                    background: isActive ? "rgba(255,255,255,0.08)" : "transparent",
                    color: isActive ? "#fff" : "rgba(255,255,255,0.65)",
                    fontSize: 12.5,
                    fontWeight: isActive ? 600 : 500,
                    textDecoration: "none",
                    marginBottom: 2,
                    letterSpacing: -0.1,
                  }}
                >
                  <NavIcon d={n.icon} />
                  {n.label}
                </Link>
              );
            })}
          </nav>

          <div style={{ padding: 12, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                background: "rgba(194,78,47,0.15)",
                border: "1px solid rgba(194,78,47,0.3)",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: "#f5b9a4",
                  letterSpacing: 0.5,
                  fontWeight: 600,
                  marginBottom: 2,
                }}
              >
                PLAN ACTIVO
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "#fff" }}>IGS Comedor</div>
              <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>
                Renueva el 15 may
              </div>
            </div>
          </div>
        </aside>
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header
          style={{
            height: 60,
            padding: "0 28px",
            borderBottom: `1px solid ${IGS.line}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: IGS.surface,
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, maxWidth: 420 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 12px",
                background: IGS.bg,
                borderRadius: 10,
                flex: 1,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={IGS.muted} strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.5-4.5" strokeLinecap="round" />
              </svg>
              <input
                placeholder="Buscar platos, mesas, mozos…"
                style={{
                  border: "none",
                  background: "transparent",
                  outline: "none",
                  fontSize: 12.5,
                  fontFamily: "inherit",
                  color: IGS.ink,
                  flex: 1,
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  color: IGS.muted,
                  padding: "2px 5px",
                  background: "#fff",
                  borderRadius: 4,
                  border: `1px solid ${IGS.line2}`,
                  fontWeight: 600,
                }}
              >
                ⌘K
              </span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <button
              aria-label="Notificaciones"
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                border: "none",
                background: IGS.bg,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={IGS.ink} strokeWidth="1.75">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 01-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span
                style={{
                  position: "absolute",
                  top: 6,
                  right: 7,
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  background: IGS.accent,
                  border: `1.5px solid ${IGS.bg}`,
                }}
              />
            </button>
            <LogoutButton owner={owner} barName={barName} initials={initials} />
          </div>
        </header>

        <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1 }}>{children}</div>
          <LegalFooter />
        </main>
      </div>
    </div>
  );
}
