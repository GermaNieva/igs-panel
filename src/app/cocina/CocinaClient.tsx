"use client";
import { useState, useEffect, useCallback, useRef, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import IGSLogo from "@/components/ui/IGSLogo";
import { IGS, STATIONS, type StationId } from "@/lib/tokens";
import { toggleItemReadyAction, markOrderReadyAction } from "./actions";
import { logoutAction } from "@/app/ingresar/actions";

export type KitchenItem = {
  id: string;
  name: string;
  qty: number;
  notes: string | null;
  station: StationId;
  ready_at: string | null;
};

export type KitchenOrder = {
  id: string;
  status: "in_kitchen" | "ready";
  sent_to_kitchen_at: string | null;
  ready_at: string | null;
  notes: string | null;
  table_number: number | null;
  table_alias: string | null;
  items: KitchenItem[];
};

const STATION_ORDER: StationId[] = ["parrilla", "caliente", "fria", "postres"];

type Props = {
  barId: string;
  initial: KitchenOrder[];
};

export default function CocinaClient({ barId, initial }: Props) {
  const [orders, setOrders] = useState<KitchenOrder[]>(initial);
  const [now, setNow] = useState(Date.now());
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const supabase = useRef(createClient()).current;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("orders")
      .select(`
        id, status, sent_to_kitchen_at, ready_at, notes, table_id,
        tables(number, alias),
        order_items(id, name_snapshot, qty, notes, station, ready_at)
      `)
      .eq("bar_id", barId)
      .in("status", ["in_kitchen", "ready"])
      .order("sent_to_kitchen_at", { ascending: true });

    const next: KitchenOrder[] = (data ?? []).map((o) => {
      const tables = o.tables as { number: number; alias: string | null } | { number: number; alias: string | null }[] | null;
      const table = Array.isArray(tables) ? tables[0] : tables;
      return {
        id: o.id,
        status: o.status as KitchenOrder["status"],
        sent_to_kitchen_at: o.sent_to_kitchen_at,
        ready_at: o.ready_at,
        notes: o.notes,
        table_number: table?.number ?? null,
        table_alias: table?.alias ?? null,
        items: (o.order_items ?? []).map((it: {
          id: string; name_snapshot: string; qty: number; notes: string | null;
          station: string; ready_at: string | null;
        }) => ({
          id: it.id,
          name: it.name_snapshot,
          qty: it.qty,
          notes: it.notes,
          station: it.station as StationId,
          ready_at: it.ready_at,
        })),
      };
    });
    setOrders(next);
  }, [supabase, barId]);

  useEffect(() => {
    const channel = supabase
      .channel(`cocina-${barId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `bar_id=eq.${barId}` },
        () => refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_items" },
        () => refresh()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, barId, refresh]);

  function handleToggleItem(item: KitchenItem) {
    setPendingId(item.id);
    startTransition(async () => {
      const res = await toggleItemReadyAction(item.id, !item.ready_at);
      setPendingId(null);
      if (!res.ok) alert(res.error);
    });
  }

  function handleMarkAllReady(orderId: string) {
    setPendingId(orderId);
    startTransition(async () => {
      const res = await markOrderReadyAction(orderId);
      setPendingId(null);
      if (!res.ok) alert(res.error);
    });
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f0f0e",
        color: "#fbfaf7",
        fontFamily: "var(--font-inter), system-ui, sans-serif",
      }}
    >
      <header
        style={{
          padding: "14px 22px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          background: "#0f0f0e",
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <IGSLogo size={22} inverted />
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: 1, textTransform: "uppercase" }}>
            KDS · Cocina
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <StationCounters orders={orders} />
          <Link
            href="/mozo"
            style={{
              padding: "6px 12px",
              background: "rgba(255,255,255,0.1)",
              color: "#fff",
              borderRadius: 18,
              fontSize: 11,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            ← Vista mozo
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              aria-label="Salir"
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                border: "none",
                background: "rgba(255,255,255,0.08)",
                color: "#fff",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              ⎋
            </button>
          </form>
        </div>
      </header>

      {orders.length === 0 ? (
        <div
          style={{
            padding: "100px 24px",
            textAlign: "center",
            color: "rgba(255,255,255,0.5)",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>🍽</div>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Cocina al día</div>
          <div style={{ fontSize: 13 }}>No hay pedidos esperando. Cuando el mozo confirme uno, aparece acá.</div>
        </div>
      ) : (
        <div
          style={{
            padding: 22,
            display: "grid",
            gap: 18,
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            alignItems: "start",
          }}
        >
          {orders.map((o) => (
            <OrderTicket
              key={o.id}
              order={o}
              now={now}
              pending={pendingId === o.id || o.items.some((it) => it.id === pendingId)}
              onToggleItem={handleToggleItem}
              onMarkAllReady={() => handleMarkAllReady(o.id)}
            />
          ))}
        </div>
      )}

      <style jsx>{`
        @keyframes cocinaPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(106,158,127,0.6); }
          50% { box-shadow: 0 0 0 8px rgba(106,158,127,0); }
        }
      `}</style>
    </div>
  );
}

function StationCounters({ orders }: { orders: KitchenOrder[] }) {
  const counts: Record<StationId, number> = { parrilla: 0, caliente: 0, fria: 0, postres: 0 };
  for (const o of orders) {
    for (const it of o.items) {
      if (!it.ready_at) counts[it.station] += it.qty;
    }
  }
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {STATION_ORDER.map((s) => {
        const cfg = STATIONS[s];
        const n = counts[s];
        return (
          <div
            key={s}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 10px",
              borderRadius: 10,
              background: n > 0 ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
              fontSize: 11.5,
              fontWeight: 600,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: 4, background: cfg.color }} />
            <span style={{ color: "rgba(255,255,255,0.7)" }}>{cfg.label}</span>
            <span
              style={{
                background: n > 0 ? cfg.color : "rgba(255,255,255,0.15)",
                color: "#fff",
                fontWeight: 700,
                padding: "1px 7px",
                borderRadius: 10,
                minWidth: 18,
                textAlign: "center",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {n}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function OrderTicket({
  order,
  now,
  pending,
  onToggleItem,
  onMarkAllReady,
}: {
  order: KitchenOrder;
  now: number;
  pending: boolean;
  onToggleItem: (item: KitchenItem) => void;
  onMarkAllReady: () => void;
}) {
  const ts = order.sent_to_kitchen_at ?? order.ready_at;
  const elapsedSec = ts ? Math.max(0, Math.floor((now - new Date(ts).getTime()) / 1000)) : 0;
  const elapsedM = Math.floor(elapsedSec / 60);
  const tone =
    order.status === "ready"
      ? "ready"
      : elapsedM < 5
      ? "ok"
      : elapsedM < 12
      ? "warn"
      : "danger";
  const toneColor =
    tone === "ready" ? "#6a9e7f" : tone === "ok" ? "#6a9e7f" : tone === "warn" ? "#d9b441" : "#c24e2f";

  const totalItems = order.items.reduce((s, i) => s + i.qty, 0);
  const readyItems = order.items.filter((i) => i.ready_at).reduce((s, i) => s + i.qty, 0);

  // Agrupar por estación
  const byStation = STATION_ORDER.map((s) => ({
    station: s,
    items: order.items.filter((it) => it.station === s),
  })).filter((g) => g.items.length > 0);

  return (
    <div
      style={{
        background: order.status === "ready" ? "rgba(106,158,127,0.12)" : "#1c1b18",
        border: `2px solid ${toneColor}`,
        borderRadius: 14,
        overflow: "hidden",
        animation: order.status === "ready" ? "cocinaPulse 1.6s ease-in-out infinite" : undefined,
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: -0.6,
              lineHeight: 1,
              color: "#fff",
            }}
          >
            Mesa {order.table_number != null ? String(order.table_number).padStart(2, "0") : "?"}
          </div>
          {order.table_alias && (
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 3 }}>
              {order.table_alias}
            </div>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: toneColor,
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
            }}
          >
            ⏱ {fmtElapsed(elapsedSec)}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>
            {readyItems}/{totalItems} listos
          </div>
        </div>
      </div>

      {order.notes && (
        <div
          style={{
            padding: "8px 16px",
            background: "rgba(217,180,65,0.18)",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            fontSize: 12,
            color: "#f5dc8c",
          }}
        >
          📝 <b>Nota mesa:</b> {order.notes}
        </div>
      )}

      <div style={{ padding: "10px 16px 14px" }}>
        {byStation.map((g) => {
          const cfg = STATIONS[g.station];
          return (
            <div key={g.station} style={{ marginBottom: 10 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                  color: cfg.color,
                  marginBottom: 6,
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 4, background: cfg.color }} />
                {cfg.label}
              </div>
              {g.items.map((it) => (
                <ItemRow
                  key={it.id}
                  item={it}
                  pending={pending}
                  onClick={() => onToggleItem(it)}
                />
              ))}
            </div>
          );
        })}
      </div>

      {order.status === "in_kitchen" && (
        <button
          onClick={onMarkAllReady}
          disabled={pending}
          style={{
            width: "100%",
            padding: "14px",
            background: "rgba(255,255,255,0.05)",
            color: "rgba(255,255,255,0.8)",
            border: "none",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            cursor: pending ? "wait" : "pointer",
            fontSize: 12,
            fontWeight: 600,
            fontFamily: "inherit",
          }}
        >
          ✓ Marcar toda la mesa como lista
        </button>
      )}

      {order.status === "ready" && (
        <div
          style={{
            padding: "14px 16px",
            background: "rgba(106,158,127,0.2)",
            color: "#7fbf9a",
            textAlign: "center",
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: 0.3,
          }}
        >
          ✓ LISTO PARA SERVIR
        </div>
      )}
    </div>
  );
}

function ItemRow({
  item,
  pending,
  onClick,
}: {
  item: KitchenItem;
  pending: boolean;
  onClick: () => void;
}) {
  const ready = !!item.ready_at;
  return (
    <button
      onClick={onClick}
      disabled={pending}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "8px 10px",
        marginBottom: 4,
        background: ready ? "rgba(106,158,127,0.12)" : "transparent",
        border: `1px solid ${ready ? "rgba(106,158,127,0.3)" : "rgba(255,255,255,0.06)"}`,
        borderRadius: 8,
        cursor: pending ? "wait" : "pointer",
        textAlign: "left",
        fontFamily: "inherit",
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          border: ready ? "none" : "2px solid rgba(255,255,255,0.25)",
          background: ready ? "#6a9e7f" : "transparent",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontSize: 12,
          fontWeight: 700,
          marginTop: 1,
        }}
      >
        {ready ? "✓" : ""}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: ready ? "rgba(255,255,255,0.5)" : "#fff",
            textDecoration: ready ? "line-through" : "none",
          }}
        >
          {item.qty}× {item.name}
        </div>
        {item.notes && (
          <div
            style={{
              marginTop: 4,
              padding: "3px 8px",
              background: "rgba(217,180,65,0.18)",
              color: "#f5dc8c",
              fontSize: 11,
              borderRadius: 6,
              display: "inline-block",
            }}
          >
            📝 {item.notes}
          </div>
        )}
      </div>
    </button>
  );
}

function fmtElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}h${String(m % 60).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}
