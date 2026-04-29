import Link from "next/link";
import { IGS } from "@/lib/tokens";

const links = [
  { href: "/terminos", label: "Términos" },
  { href: "/privacidad", label: "Privacidad" },
];

const SUPPORT_EMAIL = "igs.solucionesweb@gmail.com";

export default function LegalFooter({
  variant = "full",
}: {
  variant?: "full" | "minimal";
}) {
  if (variant === "minimal") {
    // Versión chiquita para la carta pública del cliente.
    return (
      <footer
        style={{
          padding: "16px 20px 24px",
          textAlign: "center",
          fontSize: 11,
          color: IGS.muted,
          lineHeight: 1.5,
        }}
      >
        Al hacer un pedido aceptás nuestra{" "}
        <Link href="/privacidad" style={{ color: IGS.muted, textDecoration: "underline" }}>
          política de privacidad
        </Link>
        .
        <div style={{ marginTop: 6 }}>
          Powered by <b style={{ color: IGS.ink2 }}>IGS Soluciones Web</b>
        </div>
      </footer>
    );
  }

  return (
    <footer
      style={{
        marginTop: "auto",
        padding: "20px 32px",
        borderTop: `1px solid ${IGS.line}`,
        background: IGS.surface,
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: 12,
        color: IGS.muted,
      }}
    >
      <div>© {new Date().getFullYear()} IGS Soluciones Web</div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            style={{ color: IGS.muted, textDecoration: "none" }}
          >
            {l.label}
          </Link>
        ))}
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          style={{ color: IGS.muted, textDecoration: "none" }}
        >
          Soporte
        </a>
      </div>
    </footer>
  );
}
