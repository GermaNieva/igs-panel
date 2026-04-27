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

// ============== PreApproval (suscripción individual con plan inline) ==============
// Cada bar crea su propia preapproval con monto fijo $30.000/mes.
// Esto es más flexible que un PreApproval Plan compartido.

type CreatePreapprovalInput = {
  payer_email: string;
  reason: string;
  amount: number;
  external_reference: string; // bar_id
  back_url?: string; // opcional — MP exige HTTPS público; si es localhost lo omitimos
  notification_url?: string; // opcional — idem; MP exige HTTPS público para que dispare el webhook
};

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

export async function createPreapproval(input: CreatePreapprovalInput): Promise<Preapproval> {
  // MP exige back_url y notification_url HTTPS públicos — si son localhost / vacío, los omitimos.
  const validBackUrl = isPublicHttpsUrl(input.back_url) ? input.back_url : undefined;
  const validNotificationUrl = isPublicHttpsUrl(input.notification_url)
    ? input.notification_url
    : undefined;

  const body: Record<string, unknown> = {
    reason: input.reason,
    external_reference: input.external_reference,
    payer_email: input.payer_email,
    auto_recurring: {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: input.amount,
      currency_id: "ARS",
    },
    status: "pending",
  };
  if (validBackUrl) body.back_url = validBackUrl;
  if (validNotificationUrl) body.notification_url = validNotificationUrl;

  return mpRequest<Preapproval>("/preapproval", {
    method: "POST",
    body,
  });
}

function isPublicHttpsUrl(url: string | undefined): url is string {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    // localhost / IP privadas no son válidas para MP
    if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(u.hostname)) return false;
    return true;
  } catch {
    return false;
  }
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
export const PLAN_PRICE = 30000;
export const PLAN_NAME = "IGS Comedor — plan mensual";
