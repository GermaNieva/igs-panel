"use client";
import { InputHTMLAttributes, CSSProperties, ReactNode } from "react";
import { IGS } from "@/lib/tokens";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "style"> & {
  label?: string;
  hint?: string;
  icon?: ReactNode;
  style?: CSSProperties;
  inputStyle?: CSSProperties;
};

export default function IGSInput({ label, hint, icon, style, inputStyle, ...rest }: Props) {
  return (
    <label style={{ display: "block", ...style }}>
      {label && (
        <div
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            color: IGS.ink2,
            marginBottom: 6,
            letterSpacing: -0.1,
          }}
        >
          {label}
        </div>
      )}
      <div style={{ position: "relative" }}>
        {icon && (
          <div
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: IGS.muted,
              display: "flex",
            }}
          >
            {icon}
          </div>
        )}
        <input
          {...rest}
          style={{
            width: "100%",
            height: 40,
            padding: icon ? "0 14px 0 38px" : "0 14px",
            borderRadius: 10,
            border: `1px solid ${IGS.line2}`,
            background: "#fff",
            fontSize: 13,
            fontFamily: "inherit",
            color: IGS.ink,
            outline: "none",
            ...inputStyle,
          }}
        />
      </div>
      {hint && (
        <div style={{ fontSize: 10.5, color: IGS.muted, marginTop: 5 }}>{hint}</div>
      )}
    </label>
  );
}
