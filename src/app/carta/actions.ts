"use server";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/rate-limit";

type LineItem = {
  menu_item_id: string;
  qty: number;
  notes?: string;
};

type Result =
  | { ok: true; order_id: string }
  | { ok: false; error: string };

// Límites de rate (por ventana de 5 minutos):
//  - Por mesa: máx 5 llamadas en 5 min — protege contra clientes accidentalmente
//    spameando el botón.
//  - Por IP: máx 30 llamadas en 5 min — protege contra bots / DoS de cocina.
const PER_TABLE_MAX = 5;
const PER_IP_MAX = 30;
const WINDOW_SECONDS = 300;

export async function callWaiterAction(input: {
  bar_id: string;
  table_id: string;
  items: LineItem[];
}): Promise<Result> {
  if (!input.bar_id || !input.table_id) return { ok: false, error: "Faltan datos." };

  // Rate limit anónimo: este endpoint lo invoca cualquiera con el QR de mesa.
  const h = await headers();
  const ip = clientIpFromHeaders(h);

  const [tableOk, ipOk] = await Promise.all([
    checkRateLimit(`call-waiter:table:${input.table_id}`, PER_TABLE_MAX, WINDOW_SECONDS),
    checkRateLimit(`call-waiter:ip:${ip}`, PER_IP_MAX, WINDOW_SECONDS),
  ]);
  if (!tableOk || !ipOk) {
    return {
      ok: false,
      error: "Demasiadas llamadas seguidas. Esperá un momento antes de pedir de nuevo.",
    };
  }

  // Usamos admin client porque el cliente público no está logueado y los inserts pasan
  // por las políticas anon, pero queremos que el orden/items queden con bar_id correcto.
  const admin = createAdminClient();

  // Verificar que la mesa pertenezca al bar
  const { data: table } = await admin
    .from("tables")
    .select("id, bar_id")
    .eq("id", input.table_id)
    .maybeSingle();
  if (!table || table.bar_id !== input.bar_id) {
    return { ok: false, error: "Mesa inválida." };
  }

  // Cargar los menu items para snapshot de nombre/precio/estación
  const itemIds = input.items.map((i) => i.menu_item_id);
  if (itemIds.length === 0) return { ok: false, error: "Tu pedido está vacío." };

  const { data: menuItems, error: itemsErr } = await admin
    .from("menu_items")
    .select("id, name, price, station, active, bar_id")
    .in("id", itemIds);
  if (itemsErr) return { ok: false, error: itemsErr.message };

  const lineRows: {
    menu_item_id: string;
    name_snapshot: string;
    unit_price: number;
    qty: number;
    notes: string | null;
    station: string;
  }[] = [];
  let total = 0;

  for (const li of input.items) {
    const mi = menuItems?.find((m) => m.id === li.menu_item_id);
    if (!mi || !mi.active || mi.bar_id !== input.bar_id) continue;
    const qty = Math.max(1, Math.round(li.qty));
    lineRows.push({
      menu_item_id: mi.id,
      name_snapshot: mi.name,
      unit_price: mi.price,
      qty,
      notes: li.notes?.trim() || null,
      station: mi.station,
    });
    total += mi.price * qty;
  }

  if (lineRows.length === 0) return { ok: false, error: "Ningún ítem es válido." };

  const now = new Date().toISOString();
  const { data: order, error: orderErr } = await admin
    .from("orders")
    .insert({
      bar_id: input.bar_id,
      table_id: input.table_id,
      status: "calling_waiter",
      called_at: now,
      total,
    })
    .select("id")
    .single();
  if (orderErr) return { ok: false, error: orderErr.message };

  const { error: linesErr } = await admin
    .from("order_items")
    .insert(lineRows.map((r) => ({ ...r, order_id: order.id })));
  if (linesErr) return { ok: false, error: linesErr.message };

  // Marcar mesa como "called"
  await admin
    .from("tables")
    .update({ status: "called", called_at: now })
    .eq("id", input.table_id);

  return { ok: true, order_id: order.id };
}
