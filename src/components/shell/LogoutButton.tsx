"use client";
import { useState, useRef, useEffect } from "react";
import { logoutAction } from "@/app/ingresar/actions";
import { IGS } from "@/lib/tokens";

type Props = {
  owner: string;
  barName: string;
  initials: string;
};

export default function LogoutButton({ owner, barName, initials }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          cursor: "pointer",
          background: "none",
          border: "none",
          padding: 0,
          fontFamily: "inherit",
        }}
      >
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1, color: IGS.ink }}>{owner}</div>
          <div style={{ fontSize: 10.5, color: IGS.muted, marginTop: 2 }}>{barName}</div>
        </div>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            background: IGS.ink,
            color: "#fff",
            fontSize: 12,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {initials}
        </div>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 220,
            background: "#fff",
            borderRadius: 12,
            border: `1px solid ${IGS.line}`,
            boxShadow: "0 8px 28px rgba(0,0,0,0.08)",
            padding: 6,
            zIndex: 20,
          }}
        >
          <div style={{ padding: "8px 10px 10px", borderBottom: `1px solid ${IGS.line}` }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{owner}</div>
            <div style={{ fontSize: 11, color: IGS.muted, marginTop: 2 }}>{barName}</div>
          </div>
          <form action={logoutAction} style={{ padding: "6px 0 2px" }}>
            <button
              type="submit"
              style={{
                width: "100%",
                textAlign: "left",
                padding: "9px 10px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                borderRadius: 8,
                fontSize: 12.5,
                color: IGS.danger,
                fontWeight: 500,
                fontFamily: "inherit",
              }}
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
