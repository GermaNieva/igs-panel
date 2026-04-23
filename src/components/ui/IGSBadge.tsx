import { CSSProperties, ReactNode } from "react";
import { IGS } from "@/lib/tokens";

type Tone = "neutral" | "ok" | "warn" | "danger" | "accent";

const TONES: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: IGS.bg, fg: IGS.ink2 },
  ok:      { bg: "rgba(106,158,127,0.12)", fg: "#3f7a57" },
  warn:    { bg: "rgba(217,180,65,0.14)", fg: "#8a6c14" },
  danger:  { bg: "rgba(194,78,47,0.12)", fg: "#a3391e" },
  accent:  { bg: "rgba(194,78,47,0.12)", fg: "#a3391e" },
};

type Props = {
  children: ReactNode;
  tone?: Tone;
  style?: CSSProperties;
};

export default function IGSBadge({ children, tone = "neutral", style }: Props) {
  const t = TONES[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 8px",
        borderRadius: 10,
        background: t.bg,
        color: t.fg,
        fontSize: 10.5,
        fontWeight: 600,
        letterSpacing: 0.1,
        ...style,
      }}
    >
      {children}
    </span>
  );
}
