"use client";
import { useState, useTransition, useRef, useMemo, useEffect } from "react";
import IGSButton from "@/components/ui/IGSButton";
import IGSBadge from "@/components/ui/IGSBadge";
import IGSInput from "@/components/ui/IGSInput";
import { IGS, STATIONS, type StationId, formatARS } from "@/lib/tokens";
import {
  createCategoryAction,
  renameCategoryAction,
  deleteCategoryAction,
  createMenuItemAction,
  updateMenuItemAction,
  toggleMenuItemActiveAction,
  deleteMenuItemAction,
  uploadMenuItemPhotoAction,
  seedDefaultCategoriesAction,
} from "./actions";

export type CartaCategory = { id: string; name: string; count: number };
export type CartaItem = {
  id: string;
  category_id: string;
  name: string;
  description: string;
  price: number;
  station: StationId;
  active: boolean;
  photo_url: string | null;
};

type Props = {
  categories: CartaCategory[];
  items: CartaItem[];
};

export default function CartaClient({ categories, items }: Props) {
  const [activeCat, setActiveCat] = useState<string | null>(categories[0]?.id ?? null);
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  // Reset selección cuando cambia categoría
  useEffect(() => {
    if (selected) {
      const it = items.find((i) => i.id === selected);
      if (!it || it.category_id !== activeCat) setSelected(null);
    }
  }, [activeCat, selected, items]);

  const filteredItems = useMemo(
    () => items.filter((i) => i.category_id === activeCat),
    [items, activeCat]
  );
  const sel = useMemo(
    () => (selected ? items.find((i) => i.id === selected) ?? null : null),
    [selected, items]
  );

  function flash(ok: boolean, msg: string) {
    setFeedback({ ok, msg });
    setTimeout(() => setFeedback((f) => (f?.msg === msg ? null : f)), 2400);
  }

  // ============ acciones ============
  function handleSeed() {
    startTransition(async () => {
      const res = await seedDefaultCategoriesAction();
      if (!res.ok) flash(false, res.error);
    });
  }

  function handleCreateCat() {
    const name = newCatName.trim();
    if (!name) return;
    startTransition(async () => {
      const res = await createCategoryAction(name);
      if (res.ok) {
        setNewCatName("");
        setNewCatOpen(false);
        setActiveCat(res.data.id);
      } else flash(false, res.error);
    });
  }

  function handleDeleteCat(id: string) {
    if (!confirm("¿Borrar la categoría y todos sus platos?")) return;
    startTransition(async () => {
      const res = await deleteCategoryAction(id);
      if (res.ok) {
        if (activeCat === id) setActiveCat(categories.find((c) => c.id !== id)?.id ?? null);
        flash(true, "Categoría borrada.");
      } else flash(false, res.error);
    });
  }

  function handleCreateItem() {
    if (!activeCat) return;
    startTransition(async () => {
      const res = await createMenuItemAction({
        category_id: activeCat,
        name: "Plato sin nombre",
        description: "",
        price: 0,
        station: "caliente",
      });
      if (res.ok) setSelected(res.data.id);
      else flash(false, res.error);
    });
  }

  function handleToggleActive(id: string, active: boolean) {
    startTransition(async () => {
      const res = await toggleMenuItemActiveAction(id, active);
      if (!res.ok) flash(false, res.error);
    });
  }

  if (categories.length === 0) {
    return <EmptyState onSeed={handleSeed} pending={pending} />;
  }

  const activeCategoryName = categories.find((c) => c.id === activeCat)?.name ?? "Categorías";

  return (
    <div style={{ display: "flex", minHeight: "calc(100vh - 60px)" }}>
      {/* SIDEBAR CATEGORÍAS */}
      <aside
        style={{
          width: 220,
          borderRight: `1px solid ${IGS.line}`,
          background: IGS.surface,
          padding: "22px 16px",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: IGS.muted,
            fontWeight: 600,
            letterSpacing: 0.8,
            marginBottom: 12,
            textTransform: "uppercase",
          }}
        >
          Categorías
        </div>
        {categories.map((c) => {
          const active = c.id === activeCat;
          return (
            <CategoryRow
              key={c.id}
              cat={c}
              active={active}
              onClick={() => setActiveCat(c.id)}
              onDelete={() => handleDeleteCat(c.id)}
              onRename={(name) =>
                startTransition(async () => {
                  const res = await renameCategoryAction(c.id, name);
                  if (!res.ok) flash(false, res.error);
                })
              }
            />
          );
        })}

        {newCatOpen ? (
          <div style={{ marginTop: 8, display: "flex", gap: 4 }}>
            <input
              autoFocus
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateCat();
                if (e.key === "Escape") {
                  setNewCatOpen(false);
                  setNewCatName("");
                }
              }}
              placeholder="Nombre"
              style={{
                flex: 1,
                height: 32,
                padding: "0 10px",
                borderRadius: 8,
                border: `1px solid ${IGS.line2}`,
                fontSize: 12.5,
                outline: "none",
                fontFamily: "inherit",
              }}
            />
            <button
              onClick={handleCreateCat}
              style={{
                width: 32,
                height: 32,
                border: "none",
                borderRadius: 8,
                background: IGS.ink,
                color: "#fff",
                cursor: "pointer",
              }}
              aria-label="Crear"
            >
              ✓
            </button>
          </div>
        ) : (
          <button
            onClick={() => setNewCatOpen(true)}
            style={{
              width: "100%",
              marginTop: 14,
              padding: "9px 12px",
              border: `1px dashed ${IGS.line2}`,
              background: "transparent",
              borderRadius: 8,
              fontSize: 12,
              color: IGS.muted,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            + Nueva categoría
          </button>
        )}
      </aside>

      {/* TABLA DE ITEMS */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div
          style={{
            padding: "22px 28px 14px",
            borderBottom: `1px solid ${IGS.line}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.5 }}>{activeCategoryName}</div>
            <div style={{ fontSize: 12, color: IGS.muted, marginTop: 2 }}>
              {filteredItems.length} {filteredItems.length === 1 ? "plato" : "platos"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <IGSButton
              variant="primary"
              size="sm"
              onClick={handleCreateItem}
              disabled={pending || !activeCat}
              icon={<span style={{ fontSize: 15, marginTop: -2 }}>+</span>}
            >
              Nuevo plato
            </IGSButton>
          </div>
        </div>

        <div style={{ flex: 1, overflow: "auto" }}>
          {filteredItems.length === 0 ? (
            <div
              style={{
                padding: "60px 20px",
                textAlign: "center",
                color: IGS.muted,
                fontSize: 13,
              }}
            >
              <div style={{ marginBottom: 14 }}>Esta categoría no tiene platos todavía.</div>
              <IGSButton variant="primary" size="sm" onClick={handleCreateItem} disabled={pending}>
                + Crear primer plato
              </IGSButton>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: IGS.bg, position: "sticky", top: 0 }}>
                  {["Plato", "Estación", "Precio", "Estado", ""].map((h, i) => (
                    <th
                      key={i}
                      style={{
                        textAlign: "left",
                        padding: "10px 16px",
                        fontSize: 10.5,
                        color: IGS.muted,
                        fontWeight: 600,
                        letterSpacing: 0.5,
                        textTransform: "uppercase",
                        borderBottom: `1px solid ${IGS.line}`,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((it) => {
                  const st = STATIONS[it.station];
                  const isSel = it.id === selected;
                  return (
                    <tr
                      key={it.id}
                      onClick={() => setSelected(it.id)}
                      style={{
                        background: isSel ? "rgba(194,78,47,0.06)" : "transparent",
                        borderBottom: `1px solid ${IGS.line}`,
                        cursor: "pointer",
                      }}
                    >
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <ItemThumb url={it.photo_url} />
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                letterSpacing: -0.1,
                                marginBottom: 2,
                              }}
                            >
                              {it.name}
                            </div>
                            <div
                              style={{
                                fontSize: 11.5,
                                color: IGS.muted,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                maxWidth: 320,
                              }}
                            >
                              {it.description || "—"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span
                          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}
                        >
                          <span
                            style={{ width: 8, height: 8, borderRadius: 4, background: st.color }}
                          />
                          {st.label}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          fontWeight: 600,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {formatARS(it.price)}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <button
                          aria-label="Activar / desactivar"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleActive(it.id, !it.active);
                          }}
                          style={{
                            width: 34,
                            height: 20,
                            borderRadius: 10,
                            border: "none",
                            cursor: "pointer",
                            background: it.active ? IGS.ok : IGS.line2,
                            position: "relative",
                            padding: 0,
                          }}
                        >
                          <span
                            style={{
                              position: "absolute",
                              top: 2,
                              left: it.active ? 16 : 2,
                              width: 16,
                              height: 16,
                              borderRadius: 8,
                              background: "#fff",
                              transition: "left 0.15s",
                            }}
                          />
                        </button>
                      </td>
                      <td style={{ padding: "12px 16px", color: IGS.muted, textAlign: "right" }}>
                        →
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* EDITOR LATERAL */}
      {sel && (
        <ItemEditor
          key={sel.id}
          item={sel}
          onClose={() => setSelected(null)}
          onFlash={flash}
        />
      )}

      {feedback && (
        <div
          role="status"
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            padding: "10px 14px",
            borderRadius: 10,
            background: feedback.ok ? "#1a4332" : "#5a1f12",
            color: "#fff",
            fontSize: 12.5,
            fontWeight: 500,
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
            zIndex: 100,
          }}
        >
          {feedback.msg}
        </div>
      )}
    </div>
  );
}

// ====================================================================
function EmptyState({ onSeed, pending }: { onSeed: () => void; pending: boolean }) {
  return (
    <div style={{ padding: "60px 32px", maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.6, marginBottom: 8 }}>
        Tu carta está vacía
      </div>
      <div style={{ fontSize: 13.5, color: IGS.muted, marginBottom: 24, lineHeight: 1.5 }}>
        Empezá creando categorías (entradas, principales, postres…) y después agregás platos a cada
        una. Si querés, te creamos las 4 más comunes para arrancar más rápido.
      </div>
      <IGSButton size="lg" onClick={onSeed} disabled={pending}>
        {pending ? "Creando..." : "Crear 4 categorías de ejemplo"}
      </IGSButton>
    </div>
  );
}

// ====================================================================
function CategoryRow({
  cat,
  active,
  onClick,
  onDelete,
  onRename,
}: {
  cat: CartaCategory;
  active: boolean;
  onClick: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(cat.name);

  if (editing) {
    return (
      <div style={{ display: "flex", gap: 4, marginBottom: 2 }}>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            if (name.trim() && name !== cat.name) onRename(name.trim());
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") {
              setName(cat.name);
              setEditing(false);
            }
          }}
          style={{
            flex: 1,
            height: 32,
            padding: "0 10px",
            borderRadius: 8,
            border: `1px solid ${IGS.line2}`,
            fontSize: 12.5,
            outline: "none",
            fontFamily: "inherit",
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        marginBottom: 2,
        background: active ? IGS.bg : "transparent",
        borderRadius: 8,
      }}
    >
      <button
        onClick={onClick}
        onDoubleClick={() => setEditing(true)}
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "9px 12px",
          border: "none",
          background: "transparent",
          fontSize: 12.5,
          fontWeight: active ? 600 : 500,
          color: IGS.ink,
          fontFamily: "inherit",
          textAlign: "left",
          cursor: "pointer",
        }}
        title="Doble clic para renombrar"
      >
        <span>{cat.name}</span>
        <span style={{ fontSize: 10.5, color: IGS.muted }}>{cat.count}</span>
      </button>
      {active && (
        <button
          onClick={onDelete}
          aria-label="Borrar categoría"
          title="Borrar categoría"
          style={{
            border: "none",
            background: "transparent",
            color: IGS.muted,
            cursor: "pointer",
            padding: "4px 8px",
            fontSize: 14,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

// ====================================================================
function ItemThumb({ url }: { url: string | null }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          objectFit: "cover",
          border: `1px solid ${IGS.line}`,
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: 8,
        background: IGS.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        border: `1px solid ${IGS.line}`,
      }}
    >
      <span style={{ fontSize: 10, color: IGS.muted }}>sin foto</span>
    </div>
  );
}

// ====================================================================
function ItemEditor({
  item,
  onClose,
  onFlash,
}: {
  item: CartaItem;
  onClose: () => void;
  onFlash: (ok: boolean, msg: string) => void;
}) {
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description ?? "");
  const [price, setPrice] = useState<number>(item.price);
  const [station, setStation] = useState<StationId>(item.station);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const dirty =
    name !== item.name ||
    description !== (item.description ?? "") ||
    price !== item.price ||
    station !== item.station;

  function handleSave() {
    startTransition(async () => {
      const res = await updateMenuItemAction({
        id: item.id,
        name,
        description,
        price,
        station,
      });
      onFlash(res.ok, res.ok ? "Plato guardado." : res.error);
    });
  }

  function handleDelete() {
    if (!confirm(`¿Borrar "${item.name}"?`)) return;
    startTransition(async () => {
      const res = await deleteMenuItemAction(item.id);
      if (res.ok) {
        onClose();
        onFlash(true, "Plato borrado.");
      } else onFlash(false, res.error);
    });
  }

  async function handlePhoto(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append("photo", file);
    const res = await uploadMenuItemPhotoAction(item.id, fd);
    setUploading(false);
    onFlash(res.ok, res.ok ? "Foto subida." : res.error);
  }

  return (
    <aside
      style={{
        width: 360,
        borderLeft: `1px solid ${IGS.line}`,
        background: IGS.surface,
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          padding: "18px 22px",
          borderBottom: `1px solid ${IGS.line}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600 }}>Editar plato</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {!dirty && <IGSBadge tone="ok">Guardado</IGSBadge>}
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: 18,
              color: IGS.muted,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "18px 22px" }}>
        <div
          style={{
            width: "100%",
            height: 160,
            borderRadius: 10,
            background: item.photo_url ? "transparent" : "#e8d5c0",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: `1px solid ${IGS.line}`,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {item.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.photo_url}
              alt={item.name}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span style={{ color: "#b38a62", fontSize: 11.5 }}>Sin foto todavía</span>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handlePhoto(f);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            style={{
              position: "absolute",
              bottom: 8,
              right: 8,
              padding: "5px 10px",
              background: "rgba(0,0,0,0.7)",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 500,
              cursor: uploading ? "wait" : "pointer",
            }}
          >
            {uploading ? "Subiendo..." : item.photo_url ? "Cambiar foto" : "Subir foto"}
          </button>
        </div>

        <IGSInput
          label="Nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ marginBottom: 12 }}
        />

        <label style={{ display: "block", marginBottom: 12 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: IGS.ink2, marginBottom: 6 }}>
            Descripción
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ingredientes, recomendaciones, alérgenos…"
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: `1px solid ${IGS.line2}`,
              background: "#fff",
              fontSize: 12.5,
              fontFamily: "inherit",
              color: IGS.ink,
              resize: "none",
              minHeight: 60,
              outline: "none",
            }}
          />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <IGSInput
            label="Precio (ARS)"
            type="number"
            min={0}
            step={50}
            value={price}
            onChange={(e) => setPrice(Number(e.target.value) || 0)}
          />
          <label>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: IGS.ink2, marginBottom: 6 }}>
              Estación
            </div>
            <select
              value={station}
              onChange={(e) => setStation(e.target.value as StationId)}
              style={{
                width: "100%",
                height: 40,
                padding: "0 12px",
                borderRadius: 10,
                border: `1px solid ${IGS.line2}`,
                background: "#fff",
                fontSize: 12.5,
                color: IGS.ink,
                fontFamily: "inherit",
                outline: "none",
              }}
            >
              <option value="parrilla">Parrilla</option>
              <option value="caliente">Cocina caliente</option>
              <option value="fria">Fría · Bar</option>
              <option value="postres">Postres</option>
            </select>
          </label>
        </div>

        <div
          style={{
            marginTop: 18,
            padding: 12,
            background: IGS.bg,
            borderRadius: 10,
            fontSize: 11.5,
            color: IGS.muted,
            lineHeight: 1.5,
          }}
        >
          <b>Variantes y adicionales</b> (porción doble, queso extra, etc) — se activan en el
          próximo paso.
        </div>
      </div>

      <div
        style={{
          padding: 16,
          borderTop: `1px solid ${IGS.line}`,
          display: "flex",
          gap: 8,
          justifyContent: "space-between",
        }}
      >
        <IGSButton variant="danger" size="sm" onClick={handleDelete} disabled={pending}>
          Eliminar
        </IGSButton>
        <div style={{ display: "flex", gap: 8 }}>
          <IGSButton
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={!dirty || pending}
            style={{ opacity: !dirty || pending ? 0.6 : 1 }}
          >
            {pending ? "..." : "Guardar"}
          </IGSButton>
        </div>
      </div>
    </aside>
  );
}
