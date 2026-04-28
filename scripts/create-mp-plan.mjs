#!/usr/bin/env node
// Crea el PreApproval Plan compartido en MercadoPago. Correr UNA vez:
//   node scripts/create-mp-plan.mjs
// Después agregar el id que imprime a .env.local y a Netlify como
// MP_PREAPPROVAL_PLAN_ID.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv(file) {
  try {
    const content = readFileSync(file, "utf-8");
    const env = {};
    for (const line of content.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!m) continue;
      const key = m[1];
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
    return env;
  } catch {
    return {};
  }
}

const fileEnv = loadEnv(resolve(".env.local"));
const env = { ...fileEnv, ...process.env };

const token = env.MP_ACCESS_TOKEN;
if (!token) {
  console.error("✗ Falta MP_ACCESS_TOKEN en .env.local");
  process.exit(1);
}

const baseUrl = env.NEXT_PUBLIC_APP_URL;
if (!baseUrl || !/^https:\/\//.test(baseUrl)) {
  console.error("✗ NEXT_PUBLIC_APP_URL debe ser una URL https pública (la de Netlify).");
  console.error("  Valor actual:", baseUrl ?? "(vacío)");
  process.exit(1);
}

const amount = Number(env.MP_PLAN_PRICE_ARS || 30000);
if (!Number.isFinite(amount) || amount <= 0) {
  console.error("✗ MP_PLAN_PRICE_ARS inválido:", env.MP_PLAN_PRICE_ARS);
  process.exit(1);
}

const reason = "IGS Comedor — plan mensual";
const backUrl = `${baseUrl}/suscripcion?mp=ok`;

const body = {
  reason,
  back_url: backUrl,
  auto_recurring: {
    frequency: 1,
    frequency_type: "months",
    transaction_amount: amount,
    currency_id: "ARS",
  },
};

console.log("→ Creando plan en MercadoPago:");
console.log(JSON.stringify(body, null, 2));

const res = await fetch("https://api.mercadopago.com/preapproval_plan", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

const text = await res.text();
let data;
try {
  data = JSON.parse(text);
} catch {
  data = text;
}

if (!res.ok) {
  console.error(`\n✗ MP error ${res.status}:`);
  console.error(typeof data === "string" ? data : JSON.stringify(data, null, 2));
  process.exit(1);
}

console.log("\n✓ Plan creado");
console.log("  id:        ", data.id);
console.log("  reason:    ", data.reason);
console.log("  amount:    ", data.auto_recurring?.transaction_amount, data.auto_recurring?.currency_id);
console.log("  back_url:  ", data.back_url);
console.log("  init_point:", data.init_point);
console.log("\nAgregá esto a .env.local y a Netlify → Site settings → Environment variables:\n");
console.log(`MP_PREAPPROVAL_PLAN_ID=${data.id}`);
