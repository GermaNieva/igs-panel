import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPreapproval } from "@/lib/mercadopago";

// Sincroniza el estado de un preapproval de MP con la fila del bar.
// Se invoca cuando el usuario vuelve del checkout con `?preapproval_id=...`,
// para no depender de que el webhook llegue rápido.
//
// Idempotente: lee el preapproval, valida que su `external_reference` sea el
// bar esperado, y actualiza `plan_status` + `mp_preapproval_id`. Si está en
// `pending` no toca el plan_status (todavía no autorizó).
export async function syncPreapprovalToBar(
  preapprovalId: string,
  expectedBarId: string
): Promise<{ ok: true; status: string } | { ok: false; error: string }> {
  let pre;
  try {
    pre = await getPreapproval(preapprovalId);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  if (pre.external_reference !== expectedBarId) {
    return { ok: false, error: "El preapproval no corresponde a este bar." };
  }

  const newPlanStatus =
    pre.status === "authorized"
      ? "active"
      : pre.status === "paused"
      ? "paused"
      : pre.status === "cancelled"
      ? "cancelled"
      : null;

  const admin = createAdminClient();
  const updates: Record<string, unknown> = {
    mp_preapproval_id: pre.id,
    updated_at: new Date().toISOString(),
  };
  if (newPlanStatus) updates.plan_status = newPlanStatus;
  await admin.from("bars").update(updates).eq("id", expectedBarId);

  return { ok: true, status: pre.status };
}
