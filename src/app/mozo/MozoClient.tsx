"use client";
import { useState, useEffect, useTransition, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import IGSLogo from "@/components/ui/IGSLogo";
import IGSButton from "@/components/ui/IGSButton";
import { IGS, formatARS } from "@/lib/tokens";
import {
  confirmOrderAction,
  dismissCallAction,
  markServedAction,
  markPaidAction,
  getOrderDetailAction,
} from "./actions";
import { logoutAction } from "@/app/ingresar/actions";

export type ActiveOrder = {
  id: string;
  status: "calling_waiter" | "in_kitchen" | "ready" | "served";
  total: number;
  called_at: string | null;
  sent_to_kitchen_at: string | null;
  ready_at: string | null;
  table_number: number | null;
  table_alias: string | null;
};

type OrderItem = {
  id: string;
  name_snapshot: string;
  unit_price: number;
  qty: number;
  notes: string | null;
  station: string;
};

type Props = {
  barId: string;
  waiterName: string;
  initialOrders: ActiveOrder[];
};

const STATUS_LABEL: Record<ActiveOrder["status"], { l: string; c: string; bg: string }> = {
  calling_waiter: { l: "Llamando al mozo", c: "#8a6c14", bg: "rgba(217,180,65,0.18)" },
  in_kitchen:     { l: "En cocina",        c: "#a3391e", bg: "rgba(194,78,47,0.10)" },
  ready:          { l: "Listo p/ servir",  c: "#3f7a57", bg: "rgba(106,158,127,0.18)" },
  served:         { l: "Servido",          c: IGS.muted, bg: IGS.bg },
};

export default function MozoClient({ barId, waiterName, initialOrders }: Props) {
  const [orders, setOrders] = useState<ActiveOrder[]>(initialOrders);
  const [filter, setFilter] = useState<"calls" | "kitchen" | "all">("calls");
  const [openId, setOpenId] = useState<string | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  // useState lazy init en lugar de useRef.current — evita acceder a refs durante render.
  const [supabase] = useState(() => createClient());

  // Cronómetro
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Realtime: refrescar cuando cambia un pedido del bar
  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("orders")
      .select("id, status, total, called_at, sent_to_kitchen_at, ready_at, table_id, tables(number, alias)")
      .eq("bar_id", barId)
      .in("status", ["calling_waiter", "in_kitchen", "ready", "served"])
      .order("called_at", { ascending: true });

    const next: ActiveOrder[] = (data ?? []).map((o) => {
      const t = o.tables as { number: number; alias: string | null } | { number: number; alias: string | null }[] | null;
      const table = Array.isArray(t) ? t[0] : t;
      return {
        id: o.id,
        status: o.status as ActiveOrder["status"],
        total: o.total ?? 0,
        called_at: o.called_at,
        sent_to_kitchen_at: o.sent_to_kitchen_at,
        ready_at: o.ready_at,
        table_number: table?.number ?? null,
        table_alias: table?.alias ?? null,
      };
    });
    setOrders(next);
  }, [supabase, barId]);

  useEffect(() => {
    const channel = supabase
      .channel(`mozo-${barId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `bar_id=eq.${barId}` },
        () => refresh()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, barId, refresh]);

  const filtered = orders.filter((o) => {
    if (filter === "calls") return o.status === "calling_waiter";
    if (filter === "kitchen") return o.status === "in_kitchen" || o.status === "ready";
    return true;
  });

  const counts = {
    calls: orders.filter((o) => o.status === "calling_waiter").length,
    kitchen: orders.filter((o) => o.status === "in_kitchen" || o.status === "ready").length,
    all: orders.length,
  };

  const open = openId ? orders.find((o) => o.id === openId) ?? null : null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: IGS.bg,
        color: IGS.ink,
        fontFamily: "var(--font-inter), system-ui, sans-serif",
        paddingBottom: 80,
      }}
    >
      <header
        style={{
          padding: "14px 16px",
          background: "#fff",
          borderBottom: `1px solid ${IGS.line}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <IGSLogo size={22} />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, lineHeight: 1 }}>{waiterName}</div>
            <div style={{ fontSize: 10, color: IGS.muted, marginTop: 2 }}>Mozo</div>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              aria-label="Salir"
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                border: "none",
                background: IGS.bg,
                color: IGS.ink,
                cursor: "pointer",
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title="Cerrar sesión"
            >
              ⎋
            </button>
          </form>
        </div>
      </header>

      <nav
        style={{
          display: "flex",
          gap: 6,
          padding: "10px 14px",
          background: IGS.bg,
          position: "sticky",
          top: 56,
          zIndex: 9,
        }}
      >
        {(
          [
            { id: "calls" as const, l: "Llamando", n: counts.calls, tone: "warn" as const },
            { id: "kitchen" as const, l: "En cocina", n: counts.kitchen, tone: "accent" as const },
            { id: "all" as const, l: "Todos", n: counts.all, tone: "neutral" as const },
          ]
        ).map((t) => {
          const sel = t.id === filter;
          return (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              style={{
                flex: 1,
                padding: "10px 8px",
                border: "none",
                borderRadius: 10,
                background: sel ? IGS.ink : "#fff",
                color: sel ? "#fff" : IGS.ink,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              {t.l}
              {t.n > 0 && (
                <span
                  style={{
                    background: sel ? "#fff" : t.tone === "warn" ? "#d9b441" : t.tone === "accent" ? IGS.accent : IGS.line2,
                    color: sel ? IGS.ink : "#fff",
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "1px 7px",
                    borderRadius: 10,
                    minWidth: 18,
                    textAlign: "center",
                  }}
                >
                  {t.n}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          filtered.map((o) => (
            <OrderCard key={o.id} order={o} now={now} onClick={() => setOpenId(o.id)} />
          ))
        )}
      </div>

      <Link
        href="/cocina"
        style={{
          position: "fixed",
          bottom: 18,
          left: 14,
          padding: "10px 14px",
          background: "#fff",
          border: `1px solid ${IGS.line2}`,
          borderRadius: 22,
          fontSize: 12,
          fontWeight: 600,
          color: IGS.ink,
          textDecoration: "none",
          boxShadow: "0 6px 20px rgba(0,0,0,0.08)",
        }}
      >
        🔥 Vista cocina
      </Link>

      {open && <OrderDetail order={open} now={now} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function EmptyState({ filter }: { filter: "calls" | "kitchen" | "all" }) {
  const msg =
    filter === "calls"
      ? "No hay llamadas activas. Cuando un cliente toque “Llamar al mozo”, aparece acá."
      : filter === "kitchen"
      ? "No hay pedidos en cocina ahora."
      : "Todo tranquilo por ahora.";
  return (
    <div
      style={{
        padding: "50px 18px",
        textAlign: "center",
        color: IGS.muted,
        fontSize: 13,
        background: "#fff",
        borderRadius: 14,
        border: `1px solid ${IGS.line}`,
      }}
    >
      <div style={{ fontSize: 32, marginBottom: 10 }}>🌿</div>
      {msg}
    </div>
  );
}

function OrderCard({
  order,
  now,
  onClick,
}: {
  order: ActiveOrder;
  now: number;
  onClick: () => void;
}) {
  const status = STATUS_LABEL[order.status];
  const ts =
    order.status === "calling_waiter"
      ? order.called_at
      : order.status === "in_kitchen"
      ? order.sent_to_kitchen_at
      : order.ready_at ?? order.sent_to_kitchen_at ?? order.called_at;
  const elapsed = elapsedFmt(ts, now);
  const pulsing = order.status === "calling_waiter";
  const ready = order.status === "ready";

  return (
    <button
      onClick={onClick}
      style={{
        background: "#fff",
        border: `1px solid ${IGS.line}`,
        borderLeft: `4px solid ${status.c}`,
        borderRadius: 14,
        padding: "14px 16px",
        textAlign: "left",
        fontFamily: "inherit",
        cursor: "pointer",
        display: "block",
        width: "100%",
        boxShadow: ready ? "0 0 0 2px rgba(106,158,127,0.25)" : "none",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.4 }}>
            Mesa {order.table_number != null ? String(order.table_number).padStart(2, "0") : "?"}
          </div>
          {order.table_alias && (
            <div style={{ fontSize: 11, color: IGS.muted, marginTop: 1 }}>{order.table_alias}</div>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "3px 9px",
              background: status.bg,
              color: status.c,
              borderRadius: 10,
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {pulsing && (
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  background: status.c,
                  animation: "mozoPulse 1.2s ease-in-out infinite",
                }}
              />
            )}
            {status.l}
          </div>
          <div
            style={{
              fontSize: 12,
              color: status.c,
              marginTop: 4,
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            ⏱ {elapsed}
          </div>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          paddingTop: 8,
          borderTop: `1px solid ${IGS.line}`,
        }}
      >
        <span style={{ fontSize: 12, color: IGS.muted }}>Ver pedido →</span>
        <span style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
          {formatARS(order.total)}
        </span>
      </div>
      <style jsx>{`
        @keyframes mozoPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.4); }
        }
      `}</style>
    </button>
  );
}

function OrderDetail({
  order,
  now,
  onClose,
}: {
  order: ActiveOrder;
  now: number;
  onClose: () => void;
}) {
  const [items, setItems] = useState<OrderItem[] | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const status = STATUS_LABEL[order.status];

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await getOrderDetailAction(order.id);
      if (!alive) return;
      if (res.ok) setItems(res.items);
      else setError(res.error);
    })();
    return () => {
      alive = false;
    };
  }, [order.id]);

  const ts =
    order.status === "calling_waiter"
      ? order.called_at
      : order.sent_to_kitchen_at ?? order.called_at;

  function action(fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error);
      else onClose();
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
        background: "rgba(15,15,14,0.55)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 520,
          background: "#fff",
          borderRadius: "20px 20px 0 0",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: `1px solid ${IGS.line}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.5 }}>
              Mesa {order.table_number != null ? String(order.table_number).padStart(2, "0") : "?"}
            </div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 9px",
                background: status.bg,
                color: status.c,
                borderRadius: 10,
                fontSize: 11,
                fontWeight: 600,
                marginTop: 4,
              }}
            >
              {status.l} · ⏱ {elapsedFmt(ts, now)}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              border: "none",
              background: "transparent",
              fontSize: 22,
              cursor: "pointer",
              color: IGS.muted,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>
          {items == null ? (
            <div style={{ padding: 30, textAlign: "center", color: IGS.muted, fontSize: 13 }}>
              Cargando ítems…
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: 30, textAlign: "center", color: IGS.muted, fontSize: 13 }}>
              Este pedido no tiene ítems.
            </div>
          ) : (
            items.map((it, i) => (
              <div
                key={it.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: "12px 0",
                  borderBottom: i < items.length - 1 ? `1px solid ${IGS.line}` : "none",
                }}
              >
                <div
                  style={{
                    minWidth: 30,
                    height: 30,
                    borderRadius: 8,
                    background: IGS.bg,
                    color: IGS.ink,
                    fontSize: 13,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {it.qty}×
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{it.name_snapshot}</div>
                  {it.notes && (
                    <div
                      style={{
                        marginTop: 4,
                        padding: "4px 8px",
                        background: "rgba(217,180,65,0.18)",
                        color: "#8a6c14",
                        fontSize: 11.5,
                        borderRadius: 6,
                        display: "inline-block",
                      }}
                    >
                      📝 {it.notes}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: IGS.muted, marginTop: 4 }}>
                    {stationLabel(it.station)} · {formatARS(it.unit_price)} c/u
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                    color: IGS.ink2,
                  }}
                >
                  {formatARS(it.unit_price * it.qty)}
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ padding: "12px 20px", borderTop: `1px solid ${IGS.line}` }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 12,
            }}
          >
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>Total</span>
            <span style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
              {formatARS(order.total)}
            </span>
          </div>
          {error && (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                background: "rgba(194,78,47,0.1)",
                border: "1px solid rgba(194,78,47,0.3)",
                color: "#a3391e",
                fontSize: 12.5,
                marginBottom: 10,
              }}
            >
              {error}
            </div>
          )}

          <ActionButtons order={order} pending={pending} onAction={action} />
        </div>
      </div>
    </div>
  );
}

function ActionButtons({
  order,
  pending,
  onAction,
}: {
  order: ActiveOrder;
  pending: boolean;
  onAction: (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => void;
}) {
  if (order.status === "calling_waiter") {
    return (
      <div style={{ display: "flex", gap: 8 }}>
        <IGSButton
          variant="ghost"
          size="lg"
          style={{ flex: 1 }}
          onClick={() => onAction(() => dismissCallAction(order.id))}
          disabled={pending}
        >
          Atendí, cancelar
        </IGSButton>
        <IGSButton
          variant="accent"
          size="lg"
          style={{ flex: 2 }}
          onClick={() => onAction(() => confirmOrderAction(order.id))}
          disabled={pending}
        >
          {pending ? "..." : "🔥 Mandar a cocina"}
        </IGSButton>
      </div>
    );
  }
  if (order.status === "in_kitchen") {
    return (
      <IGSButton
        variant="primary"
        size="lg"
        style={{ width: "100%" }}
        onClick={() => onAction(() => markServedAction(order.id))}
        disabled={pending}
      >
        Marcar como servido
      </IGSButton>
    );
  }
  if (order.status === "ready") {
    return (
      <IGSButton
        variant="accent"
        size="lg"
        style={{ width: "100%" }}
        onClick={() => onAction(() => markServedAction(order.id))}
        disabled={pending}
      >
        ✓ Servido
      </IGSButton>
    );
  }
  if (order.status === "served") {
    return (
      <IGSButton
        variant="primary"
        size="lg"
        style={{ width: "100%" }}
        onClick={() => onAction(() => markPaidAction(order.id))}
        disabled={pending}
      >
        💳 Cobrar y liberar mesa
      </IGSButton>
    );
  }
  return null;
}

// ====================================================================
function elapsedFmt(iso: string | null, now: number): string {
  if (!iso) return "—";
  const ms = now - new Date(iso).getTime();
  if (ms < 0) return "0:00";
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m > 60) {
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

function stationLabel(s: string): string {
  switch (s) {
    case "parrilla": return "🔥 Parrilla";
    case "caliente": return "🍳 Cocina caliente";
    case "fria":     return "🥤 Fría / Bar";
    case "postres":  return "🍰 Postres";
    default:         return s;
  }
}
