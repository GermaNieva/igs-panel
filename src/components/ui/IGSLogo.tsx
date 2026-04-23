import { IGS } from "@/lib/tokens";

type Props = {
  size?: number;
  inverted?: boolean;
  withText?: boolean;
};

export default function IGSLogo({ size = 22, inverted = false, withText = true }: Props) {
  const fg = inverted ? "#fff" : IGS.ink;
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.28,
          background: IGS.accent,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <svg width={size * 0.55} height={size * 0.65} viewBox="0 0 10 12" fill="none">
          <path
            d="M5 1 C 6 3.5, 8 4.5, 8 7 C 8 9.5, 6.5 11, 5 11 C 3.5 11, 2 9.5, 2 7 C 2 5.5, 3 5, 4 4 C 4.5 3, 4.5 2, 5 1 Z"
            fill="#fff"
          />
        </svg>
      </div>
      {withText && (
        <span
          style={{
            fontSize: size * 0.72,
            fontWeight: 700,
            color: fg,
            letterSpacing: -0.4,
          }}
        >
          IGS
        </span>
      )}
    </div>
  );
}
