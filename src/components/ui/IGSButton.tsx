"use client";
import { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { IGS } from "@/lib/tokens";

type Variant = "primary" | "accent" | "ghost" | "subtle" | "danger";
type Size = "sm" | "md" | "lg";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "style"> & {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  style?: CSSProperties;
};

const VARIANTS: Record<Variant, CSSProperties> = {
  primary: { background: IGS.ink, color: "#fff" },
  accent:  { background: IGS.accent, color: "#fff" },
  ghost:   { background: "transparent", color: IGS.ink, border: `1px solid ${IGS.line2}` },
  subtle:  { background: IGS.bg, color: IGS.ink },
  danger:  { background: "transparent", color: IGS.danger, border: `1px solid ${IGS.danger}40` },
};

export default function IGSButton({
  children,
  variant = "primary",
  size = "md",
  icon,
  style,
  ...rest
}: Props) {
  const h = size === "sm" ? 32 : size === "lg" ? 44 : 38;
  const px = size === "sm" ? 12 : 16;
  const fs = size === "sm" ? 12 : 13;
  return (
    <button
      {...rest}
      style={{
        height: h,
        padding: `0 ${px}px`,
        borderRadius: h / 2,
        fontFamily: "inherit",
        fontSize: fs,
        fontWeight: 600,
        letterSpacing: -0.1,
        cursor: "pointer",
        border: "none",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        transition: "all 0.15s",
        whiteSpace: "nowrap",
        ...VARIANTS[variant],
        ...style,
      }}
    >
      {icon}
      {children}
    </button>
  );
}
