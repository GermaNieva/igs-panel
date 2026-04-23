import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CartaCliente from "../../../CartaCliente";
import { loadBarCarta } from "../../page";

export default async function CartaMesaPage({
  params,
}: {
  params: Promise<{ slug: string; mesa: string }>;
}) {
  const { slug, mesa } = await params;
  const number = parseInt(mesa, 10);
  if (!Number.isFinite(number) || number <= 0) notFound();

  const data = await loadBarCarta(slug);
  if (!data) notFound();

  const supabase = await createClient();
  const { data: table } = await supabase
    .from("tables")
    .select("id, number, alias, seats, zone_id")
    .eq("bar_id", data.bar.id)
    .eq("number", number)
    .maybeSingle();

  if (!table) notFound();

  return (
    <CartaCliente
      bar={data.bar}
      categories={data.categories}
      items={data.items}
      mesa={{ id: table.id, number: table.number, alias: table.alias, seats: table.seats }}
    />
  );
}
