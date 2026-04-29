"use client";
import { useState, useMemo, useEffect, useTransition } from "react";
import { IGS, formatARS } from "@/lib/tokens";
import LegalFooter from "@/components/LegalFooter";
import { callWaiterAction } from "./actions";

export type PublicBar = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  welcome_msg: string | null;
  address: string | null;
  city: string | null;
  socials: {
    instagram?: string;
    facebook?: string;
    whatsapp?: string;
    reservation_url?: string;
  };
};

export type PublicCategory = { id: string; name: string };

export type PublicItem = {
  id: string;
  category_id: string;
  name: string;
  description: string;
  price: number;
  photo_url: string | null;
};

export type PublicMesa = { id: string; number: number; alias: string | null; seats: number };

type CartLine = { item_id: string; qty: number; notes?: string };

type Props = {
  bar: PublicBar;
  categories: PublicCategory[];
  items: PublicItem[];
  mesa: PublicMesa | null;
};

export default function CartaCliente({ bar, categories, items, mesa }: Props) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [activeCat, setActiveCat] = useState<string | null>(categories[0]?.id ?? null);
  const [detail, setDetail] = useState<PublicItem | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [confirmed, setConfirmed] = useState<{ orderId: string } | null>(null);
  const [callError, setCallError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Persistir carrito en localStorage por mesa+bar
  const cartKey = `igs-cart-${bar.slug}-${mesa?.number ?? "general"}`;
  // Hidratamos el carrito desde localStorage en mount. cartKey depende de props
  // que no cambian post-mount; localStorage no existe en SSR. La alternativa
  // pura (useSyncExternalStore) es desproporcionada.
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(cartKey);
      if (raw) setCart(JSON.parse(raw));
    } catch {}
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    try {
      localStorage.setItem(cartKey, JSON.stringify(cart));
    } catch {}
  }, [cart, cartKey]);

  const itemsByCategory = useMemo(() => {
    const map = new Map<string, PublicItem[]>();
    for (const it of items) {
      if (!map.has(it.category_id)) map.set(it.category_id, []);
      map.get(it.category_id)!.push(it);
    }
    return map;
  }, [items]);

  const itemsMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const cartTotal = cart.reduce((s, l) => {
    const it = itemsMap.get(l.item_id);
    return s + (it ? it.price * l.qty : 0);
  }, 0);
  const cartCount = cart.reduce((s, l) => s + l.qty, 0);

  function addToCart(item: PublicItem, qty = 1, notes?: string) {
    setCart((c) => {
      const idx = c.findIndex((l) => l.item_id === item.id && (l.notes ?? "") === (notes ?? ""));
      if (idx >= 0) {
        const next = [...c];
        next[idx] = { ...next[idx], qty: next[idx].qty + qty };
        return next;
      }
      return [...c, { item_id: item.id, qty, notes }];
    });
  }

  function updateQty(item_id: string, notes: string | undefined, qty: number) {
    setCart((c) => {
      if (qty <= 0) {
        return c.filter((l) => !(l.item_id === item_id && (l.notes ?? "") === (notes ?? "")));
      }
      return c.map((l) =>
        l.item_id === item_id && (l.notes ?? "") === (notes ?? "") ? { ...l, qty } : l
      );
    });
  }

  function clearCart() {
    setCart([]);
    try {
      localStorage.removeItem(cartKey);
    } catch {}
  }

  function handleCallWaiter() {
    if (!mesa) return;
    setCallError(null);
    startTransition(async () => {
      const res = await callWaiterAction({
        bar_id: bar.id,
        table_id: mesa.id,
        items: cart.map((l) => ({
          menu_item_id: l.item_id,
          qty: l.qty,
          notes: l.notes,
        })),
      });
      if (res.ok) {
        setConfirmed({ orderId: res.order_id });
        clearCart();
      } else {
        setCallError(res.error);
      }
    });
  }

  // Pantalla de confirmación
  if (confirmed) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: IGS.bg,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          textAlign: "center",
          fontFamily: "var(--font-inter), system-ui, sans-serif",
          color: IGS.ink,
        }}
      >
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: 44,
            background: IGS.accent,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 20,
            animation: "igspulse2 1.6s ease-in-out infinite",
          }}
        >
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.6, marginBottom: 8 }}>
          ¡El mozo está en camino!
        </div>
        <div style={{ fontSize: 14, color: IGS.muted, lineHeight: 1.5, maxWidth: 320, marginBottom: 24 }}>
          Recibimos tu llamada. {mesa ? `Mesa ${String(mesa.number).padStart(2, "0")}` : ""} ·
          alguien viene en un ratito.
        </div>
        <button
          onClick={() => setConfirmed(null)}
          style={{
            padding: "10px 18px",
            borderRadius: 22,
            border: `1px solid ${IGS.line2}`,
            background: "#fff",
            color: IGS.ink,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Volver a la carta
        </button>
        <style>{`
          @keyframes igspulse2 {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.06); }
          }
        `}</style>
      </div>
    );
  }

  const initials = bar.name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: IGS.bg,
        fontFamily: "var(--font-inter), system-ui, sans-serif",
        color: IGS.ink,
        paddingBottom: cart.length > 0 ? 80 : 24,
      }}
    >
      {/* Header con portada + bar info */}
      <div
        style={{
          height: 120,
          background: "linear-gradient(135deg, #d9a66b 0%, #b86340 100%)",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            bottom: -28,
            left: 18,
            width: 56,
            height: 56,
            borderRadius: 12,
            background: IGS.ink,
            color: "#fff",
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: -0.6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "3px solid #fff",
          }}
        >
          {initials}
        </div>
        {mesa && (
          <div
            style={{
              position: "absolute",
              top: 14,
              right: 14,
              padding: "5px 12px",
              background: "rgba(15,15,14,0.7)",
              color: "#fff",
              borderRadius: 12,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 0.5,
            }}
          >
            MESA {String(mesa.number).padStart(2, "0")}
          </div>
        )}
      </div>

      <div style={{ padding: "38px 18px 12px" }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>{bar.name}</div>
        {bar.tagline && (
          <div style={{ fontSize: 12.5, color: IGS.muted, marginTop: 2 }}>{bar.tagline}</div>
        )}
        {bar.welcome_msg && (
          <div
            style={{
              marginTop: 14,
              padding: "12px 14px",
              background: "#fff",
              border: `1px solid ${IGS.line}`,
              borderRadius: 10,
              fontSize: 12.5,
              color: IGS.ink2,
              lineHeight: 1.5,
            }}
          >
            {bar.welcome_msg}
          </div>
        )}
      </div>

      {/* Tabs categorías */}
      {categories.length > 0 && (
        <nav
          style={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            background: IGS.bg,
            padding: "12px 0 8px",
            overflowX: "auto",
            display: "flex",
            gap: 8,
            paddingLeft: 18,
            paddingRight: 18,
            borderBottom: `1px solid ${IGS.line}`,
            scrollbarWidth: "none",
          }}
        >
          {categories.map((c) => {
            const sel = c.id === activeCat;
            return (
              <button
                key={c.id}
                onClick={() => {
                  setActiveCat(c.id);
                  document.getElementById(`cat-${c.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                style={{
                  padding: "8px 14px",
                  borderRadius: 18,
                  border: sel ? "none" : `1px solid ${IGS.line2}`,
                  background: sel ? IGS.ink : "#fff",
                  color: sel ? "#fff" : IGS.ink,
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  fontFamily: "inherit",
                  flexShrink: 0,
                }}
              >
                {c.name}
              </button>
            );
          })}
        </nav>
      )}

      {/* Lista de categorías + items */}
      <div style={{ padding: "10px 18px 0" }}>
        {categories.map((c) => {
          const itemsCat = itemsByCategory.get(c.id) ?? [];
          if (itemsCat.length === 0) return null;
          return (
            <section key={c.id} id={`cat-${c.id}`} style={{ marginTop: 22 }}>
              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  letterSpacing: -0.3,
                  margin: "0 0 12px",
                }}
              >
                {c.name}
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {itemsCat.map((it) => (
                  <button
                    key={it.id}
                    onClick={() => setDetail(it)}
                    style={{
                      display: "flex",
                      alignItems: "stretch",
                      gap: 12,
                      padding: 12,
                      background: "#fff",
                      border: `1px solid ${IGS.line}`,
                      borderRadius: 12,
                      cursor: "pointer",
                      textAlign: "left",
                      fontFamily: "inherit",
                      width: "100%",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{it.name}</div>
                      {it.description && (
                        <div
                          style={{
                            fontSize: 12,
                            color: IGS.muted,
                            lineHeight: 1.4,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {it.description}
                        </div>
                      )}
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          marginTop: 8,
                          fontVariantNumeric: "tabular-nums",
                          color: IGS.ink,
                        }}
                      >
                        {formatARS(it.price)}
                      </div>
                    </div>
                    {it.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={it.photo_url}
                        alt={it.name}
                        style={{
                          width: 84,
                          height: 84,
                          borderRadius: 10,
                          objectFit: "cover",
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 84,
                          height: 84,
                          borderRadius: 10,
                          background: "#e8d5c0",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          fontSize: 11,
                          color: "#b38a62",
                        }}
                      >
                        sin foto
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </section>
          );
        })}

        {items.length === 0 && (
          <div
            style={{
              padding: 40,
              textAlign: "center",
              color: IGS.muted,
              fontSize: 13,
            }}
          >
            La carta está siendo preparada. Volvé en un ratito.
          </div>
        )}
      </div>

      {/* Footer con redes */}
      <footer style={{ padding: "30px 18px 12px", textAlign: "center", color: IGS.muted, fontSize: 11 }}>
        {bar.address && (
          <div>
            {bar.address}
            {bar.city ? ` · ${bar.city}` : ""}
          </div>
        )}
        <div style={{ marginTop: 6 }}>
          {bar.socials.instagram && <span>{bar.socials.instagram} </span>}
          {bar.socials.whatsapp && <span>· {bar.socials.whatsapp}</span>}
        </div>
        <div style={{ marginTop: 16, fontSize: 10 }}>
          Carta digital de IGS · igs-solucionesweb.com
        </div>
      </footer>

      {/* CTA flotante: ver pedido + llamar al mozo */}
      {cart.length > 0 && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "12px 18px calc(12px + env(safe-area-inset-bottom, 0px))",
            background: "#fff",
            borderTop: `1px solid ${IGS.line}`,
            boxShadow: "0 -10px 30px rgba(0,0,0,0.06)",
            zIndex: 20,
          }}
        >
          <button
            onClick={() => setShowCart(true)}
            style={{
              width: "100%",
              padding: "14px 18px",
              borderRadius: 14,
              background: IGS.ink,
              color: "#fff",
              border: "none",
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>
              Ver pedido ({cartCount})
            </span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatARS(cartTotal)}</span>
          </button>
        </div>
      )}

      {/* Modal detalle */}
      {detail && (
        <ItemDetailModal
          item={detail}
          onClose={() => setDetail(null)}
          onAdd={(qty, notes) => {
            addToCart(detail, qty, notes);
            setDetail(null);
          }}
        />
      )}

      {/* Modal carrito */}
      {showCart && (
        <CartSheet
          mesa={mesa}
          cart={cart}
          itemsMap={itemsMap}
          onClose={() => setShowCart(false)}
          onUpdateQty={updateQty}
          onClear={clearCart}
          onCallWaiter={handleCallWaiter}
          pending={pending}
          error={callError}
        />
      )}
      <LegalFooter variant="minimal" />
    </div>
  );
}

// ====================================================================
function ItemDetailModal({
  item,
  onClose,
  onAdd,
}: {
  item: PublicItem;
  onClose: () => void;
  onAdd: (qty: number, notes: string | undefined) => void;
}) {
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
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
          maxWidth: 480,
          background: "#fff",
          borderRadius: "20px 20px 0 0",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {item.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.photo_url}
            alt={item.name}
            style={{ width: "100%", height: 220, objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: 140,
              background: "linear-gradient(135deg, #e8d5c0 0%, #c89c70 100%)",
            }}
          />
        )}
        <div style={{ padding: "20px 20px 0", overflow: "auto", flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4 }}>{item.name}</div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  marginTop: 6,
                  fontVariantNumeric: "tabular-nums",
                  color: IGS.accent,
                }}
              >
                {formatARS(item.price)}
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
          {item.description && (
            <div
              style={{
                fontSize: 13.5,
                color: IGS.ink2,
                lineHeight: 1.5,
                marginTop: 12,
              }}
            >
              {item.description}
            </div>
          )}
          <label style={{ display: "block", marginTop: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: IGS.ink2, marginBottom: 6 }}>
              Comentario (opcional)
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: sin cebolla, jugoso…"
              style={{
                width: "100%",
                minHeight: 60,
                padding: 10,
                borderRadius: 10,
                border: `1px solid ${IGS.line2}`,
                fontFamily: "inherit",
                fontSize: 13,
                color: IGS.ink,
                resize: "none",
                outline: "none",
              }}
            />
          </label>
        </div>
        <div
          style={{
            padding: 16,
            borderTop: `1px solid ${IGS.line}`,
            display: "flex",
            gap: 10,
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              border: `1px solid ${IGS.line2}`,
              borderRadius: 22,
              overflow: "hidden",
            }}
          >
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              aria-label="Quitar"
              style={{
                width: 38,
                height: 44,
                border: "none",
                background: "transparent",
                fontSize: 18,
                cursor: "pointer",
              }}
            >
              −
            </button>
            <span style={{ width: 28, textAlign: "center", fontWeight: 600, fontSize: 14 }}>{qty}</span>
            <button
              onClick={() => setQty((q) => q + 1)}
              aria-label="Sumar"
              style={{
                width: 38,
                height: 44,
                border: "none",
                background: "transparent",
                fontSize: 18,
                cursor: "pointer",
              }}
            >
              +
            </button>
          </div>
          <button
            onClick={() => onAdd(qty, notes || undefined)}
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: 22,
              background: IGS.ink,
              color: "#fff",
              border: "none",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>Agregar al pedido</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatARS(item.price * qty)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ====================================================================
function CartSheet({
  mesa,
  cart,
  itemsMap,
  onClose,
  onUpdateQty,
  onClear,
  onCallWaiter,
  pending,
  error,
}: {
  mesa: PublicMesa | null;
  cart: CartLine[];
  itemsMap: Map<string, PublicItem>;
  onClose: () => void;
  onUpdateQty: (item_id: string, notes: string | undefined, qty: number) => void;
  onClear: () => void;
  onCallWaiter: () => void;
  pending: boolean;
  error: string | null;
}) {
  const total = cart.reduce((s, l) => {
    const it = itemsMap.get(l.item_id);
    return s + (it ? it.price * l.qty : 0);
  }, 0);

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
        zIndex: 60,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          background: "#fff",
          borderRadius: "20px 20px 0 0",
          maxHeight: "90vh",
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
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Tu pedido</div>
            {mesa && (
              <div style={{ fontSize: 11, color: IGS.muted, marginTop: 2 }}>
                Mesa {String(mesa.number).padStart(2, "0")}
              </div>
            )}
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

        <div style={{ flex: 1, overflow: "auto", padding: "12px 20px" }}>
          {cart.length === 0 ? (
            <div
              style={{
                padding: 30,
                textAlign: "center",
                color: IGS.muted,
                fontSize: 13,
              }}
            >
              Tu pedido está vacío.
            </div>
          ) : (
            cart.map((l, i) => {
              const it = itemsMap.get(l.item_id);
              if (!it) return null;
              return (
                <div
                  key={`${l.item_id}-${i}`}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: "12px 0",
                    borderBottom: i < cart.length - 1 ? `1px solid ${IGS.line}` : "none",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{it.name}</div>
                    {l.notes && (
                      <div style={{ fontSize: 11.5, color: IGS.muted, marginTop: 2, fontStyle: "italic" }}>
                        “{l.notes}”
                      </div>
                    )}
                    <div
                      style={{
                        fontSize: 12,
                        color: IGS.muted,
                        marginTop: 4,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {formatARS(it.price)} c/u · {formatARS(it.price * l.qty)}
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      border: `1px solid ${IGS.line2}`,
                      borderRadius: 18,
                      overflow: "hidden",
                      flexShrink: 0,
                    }}
                  >
                    <button
                      onClick={() => onUpdateQty(l.item_id, l.notes, l.qty - 1)}
                      aria-label="Quitar"
                      style={{
                        width: 30,
                        height: 30,
                        border: "none",
                        background: "transparent",
                        fontSize: 14,
                        cursor: "pointer",
                      }}
                    >
                      −
                    </button>
                    <span style={{ width: 22, textAlign: "center", fontWeight: 600, fontSize: 13 }}>
                      {l.qty}
                    </span>
                    <button
                      onClick={() => onUpdateQty(l.item_id, l.notes, l.qty + 1)}
                      aria-label="Sumar"
                      style={{
                        width: 30,
                        height: 30,
                        border: "none",
                        background: "transparent",
                        fontSize: 14,
                        cursor: "pointer",
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {cart.length > 0 && (
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
                {formatARS(total)}
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

            {!mesa ? (
              <div
                style={{
                  padding: "12px 14px",
                  background: IGS.bg,
                  borderRadius: 10,
                  fontSize: 12,
                  color: IGS.muted,
                  textAlign: "center",
                  marginBottom: 10,
                }}
              >
                Para llamar al mozo necesitás escanear el QR de tu mesa.
              </div>
            ) : (
              <button
                onClick={onCallWaiter}
                disabled={pending}
                style={{
                  width: "100%",
                  padding: "14px 18px",
                  borderRadius: 14,
                  background: IGS.accent,
                  color: "#fff",
                  border: "none",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: pending ? "wait" : "pointer",
                  fontFamily: "inherit",
                  marginBottom: 8,
                  opacity: pending ? 0.7 : 1,
                }}
              >
                {pending ? "Llamando…" : "🔔 Llamar al mozo"}
              </button>
            )}
            <button
              onClick={onClear}
              style={{
                width: "100%",
                padding: 8,
                background: "transparent",
                border: "none",
                color: IGS.muted,
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Vaciar pedido
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
