import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SuscripcionClient, { type SubscriptionData, type Invoice } from "./SuscripcionClient";

function daysUntil(iso: string | null): number {
  if (!iso) return 0;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export default async function SuscripcionPage({
  searchParams,
}: {
  searchParams: Promise<{ mp?: string }>;
}) {
  const sp = await searchParams;
  const justReturned = sp.mp === "ok";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("bar_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.bar_id) {
    return <div style={{ padding: 32 }}>Tu cuenta no tiene un bar asociado.</div>;
  }

  const { data: bar } = await supabase
    .from("bars")
    .select("name, plan_status, trial_ends_at, mp_preapproval_id, payer_email, tax_info")
    .eq("id", profile.bar_id)
    .maybeSingle();

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, amount, period_start, period_end, status, paid_at, pdf_url")
    .eq("bar_id", profile.bar_id)
    .order("period_start", { ascending: false })
    .limit(12);

  const trialEndsAt = bar?.trial_ends_at ?? null;
  const trialDaysLeft = daysUntil(trialEndsAt);

  const data: SubscriptionData = {
    barName: bar?.name ?? "Tu bar",
    planStatus: (bar?.plan_status ?? "trialing") as SubscriptionData["planStatus"],
    trialEndsAt,
    trialDaysLeft,
    hasPreapproval: !!bar?.mp_preapproval_id,
    canManage: ["owner", "super_admin"].includes(profile.role),
    ownerEmail: user.email ?? "",
    savedPayerEmail: bar?.payer_email ?? null,
  };

  const invoiceList: Invoice[] = (invoices ?? []).map((i) => ({
    id: i.id,
    amount: i.amount,
    period_start: i.period_start,
    period_end: i.period_end,
    status: i.status as Invoice["status"],
    paid_at: i.paid_at,
    pdf_url: i.pdf_url,
  }));

  return (
    <SuscripcionClient
      data={data}
      invoices={invoiceList}
      justReturnedFromMP={justReturned}
    />
  );
}
