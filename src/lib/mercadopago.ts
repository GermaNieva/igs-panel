// Wrapper minimalista de MercadoPago — usa fetch directo, sin SDK.
// Docs: https://www.mercadopago.com.ar/developers/es/reference

const MP_BASE = "https://api.mercadopago.com";

function getAccessToken(): string {
  const t = process.env.MP_ACCESS_TOKEN;
  if (!t) throw new Error("Falta MP_ACCESS_TOKEN en .env.local");
  return t;
}

type MpRequestInit = Omit<RequestInit, "body"> & { body?: object };

const isDev = process.env.NODE_ENV !== "production";

async function mpRequest<T>(path: string, init: MpRequestInit = {}): Promise<T> {
  const { body: bodyObj, headers, ...rest } = init;
  const method = (rest.method ?? "GET").toUpperCase();

  if (isDev) {
    // Logging para diagnosticar rechazos. Nunca incluye el Bearer.
    console.log("[mp] →", method, path, bodyObj ? JSON.stringify(bodyObj) : "");
  }

  const res = await fetch(`${MP_BASE}${path}`, {
    ...rest,
    body: bodyObj ? JSON.stringify(bodyObj) : undefined,
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
      "Content-Type": "application/json",
      ...(headers ?? {}),
    },
    cache: "no-store",
  });

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (isDev) {
    console.log("[mp] ←", res.status, typeof data === "string" ? data : JSON.stringify(data));
  }

  if (!res.ok) {
    const msg =
      (data && typeof data === "object" && "message" in data && (data as { message: string }).message) ||
      `MP error ${res.status}`;
    throw new Error(`${msg} — ${typeof data === "string" ? data : JSON.stringify(data)}`);
  }

  return data as T;
}

// ============== PreApproval Plan (compartido) ==============
// Modelo actual: un Plan único en MP, que cualquier bar usa. Cada bar agrega
// su `external_reference` por query string al checkout. Cualquier cuenta de MP
// puede pagar — no se manda payer_email, no hay validación de email.
// El plan se crea una sola vez con `node scripts/create-mp-plan.mjs` y su id
// queda en MP_PREAPPROVAL_PLAN_ID.

export type Preapproval = {
  id: string;
  status: "pending" | "authorized" | "paused" | "cancelled";
  init_point: string;
  payer_id?: number;
  payer_email?: string;
  next_payment_date?: string;
  date_created: string;
  last_modified?: string;
  reason: string;
  external_reference: string;
  auto_recurring: {
    frequency: number;
    frequency_type: "months" | "days";
    transaction_amount: number;
    currency_id: string;
    start_date?: string;
    end_date?: string;
  };
};

export type PreapprovalPlan = {
  id: string;
  status: "active" | "inactive" | "cancelled";
  init_point: string;
  reason: string;
  back_url?: string;
  auto_recurring: {
    frequency: number;
    frequency_type: "months" | "days";
    transaction_amount: number;
    currency_id: string;
  };
};

export async function createPreapprovalPlan(input: {
  reason: string;
  amount: number;
  backUrl: string;
}): Promise<PreapprovalPlan> {
  return mpRequest<PreapprovalPlan>("/preapproval_plan", {
    method: "POST",
    body: {
      reason: input.reason,
      back_url: input.backUrl,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: input.amount,
        currency_id: "ARS",
      },
    },
  });
}

// Arma el URL de checkout que el usuario abre para suscribirse al plan.
// `external_reference` queda asociado al preapproval que MP cree cuando autoriza.
export function getCheckoutUrlForPlan(input: { planId: string; barId: string }): string {
  const params = new URLSearchParams({
    preapproval_plan_id: input.planId,
    external_reference: input.barId,
  });
  return `https://www.mercadopago.com.ar/subscriptions/checkout?${params.toString()}`;
}

export async function getPreapproval(id: string): Promise<Preapproval> {
  return mpRequest<Preapproval>(`/preapproval/${id}`);
}

export async function cancelPreapproval(id: string): Promise<Preapproval> {
  return mpRequest<Preapproval>(`/preapproval/${id}`, {
    method: "PUT",
    body: { status: "cancelled" },
  });
}

export async function pausePreapproval(id: string): Promise<Preapproval> {
  return mpRequest<Preapproval>(`/preapproval/${id}`, {
    method: "PUT",
    body: { status: "paused" },
  });
}

export async function resumePreapproval(id: string): Promise<Preapproval> {
  return mpRequest<Preapproval>(`/preapproval/${id}`, {
    method: "PUT",
    body: { status: "authorized" },
  });
}

// ============== Authorized payments (pagos generados por una preapproval) ==============
// Cada cobro mensual genera un authorized_payment.

export type AuthorizedPayment = {
  id: number;
  preapproval_id: string;
  status: "pending" | "scheduled" | "processed" | "recycling" | "cancelled";
  payment_state?: "approved" | "rejected" | "pending" | "in_process";
  transaction_amount: number;
  currency_id: string;
  date_created: string;
  last_modified: string;
  payment_id?: number;
  retry_attempt?: number;
  reason?: string;
};

export async function getAuthorizedPayment(id: string | number): Promise<AuthorizedPayment> {
  return mpRequest<AuthorizedPayment>(`/authorized_payments/${id}`);
}

// ============== Plan price ==============
// Precio mensual del plan en ARS. Se lee de MP_PLAN_PRICE_ARS (entero) si está
// definido — útil para bajarlo temporalmente en pruebas reales sin redeployar
// el código. Si no, defaultea a 30000.
function readPlanPrice(): number {
  const raw = process.env.MP_PLAN_PRICE_ARS;
  if (!raw) return 30000;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 30000;
}
export const PLAN_PRICE = readPlanPrice();
export const PLAN_NAME = "IGS Comedor — plan mensual";
