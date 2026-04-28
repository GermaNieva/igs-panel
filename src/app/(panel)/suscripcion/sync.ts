import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPreapproval } from "@/lib/mercadopago";

// Sincroniza el estado de un preapproval de MP con la fila del bar.
// Se invoca cuando el usuario vuelve del checkout con `?preapproval_id=...`,
// para no depender de que el webhook llegue rápido.
//
// Reglas (mismas que el webhook para evitar inconsistencias):
//  - `authorized` SIEMPRE toma control: pasa plan_status=active y mp_preapproval_id=pre.id
//  - `paused` / `cancelled` solo aplican si el preapproval coincide con el current del bar
//  - `pending` no toca el plan_status
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

  const admin = createAdminClient();

  if (pre.status === "authorized") {
    await admin
      .from("bars")
      .update({
        plan_status: "active",
        mp_preapproval_id: pre.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", expectedBarId);
    return { ok: true, status: pre.status };
  }

  // Para otros estados: solo modificar si es el preapproval current.
  const { data: bar } = await admin
    .from("bars")
    .select("mp_preapproval_id")
    .eq("id", expectedBarId)
    .maybeSingle();

  const isCurrent = bar?.mp_preapproval_id === pre.id;

  if (pre.status === "pending") {
    // Guardamos el id solo si el bar no tiene ningún preapproval asociado aún.
    if (!bar?.mp_preapproval_id) {
      await admin
        .from("bars")
        .update({ mp_preapproval_id: pre.id, updated_at: new Date().toISOString() })
        .eq("id", expectedBarId);
    }
    return { ok: true, status: pre.status };
  }

  if (!isCurrent) return { ok: true, status: pre.status };

  const newPlanStatus =
    pre.status === "paused"
      ? "paused"
      : pre.status === "cancelled"
      ? "cancelled"
      : null;

  if (newPlanStatus) {
    await admin
      .from("bars")
      .update({ plan_status: newPlanStatus, updated_at: new Date().toISOString() })
      .eq("id", expectedBarId);
  }

  return { ok: true, status: pre.status };
}
