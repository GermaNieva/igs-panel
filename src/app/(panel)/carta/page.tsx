import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getCurrentProfile } from "@/lib/supabase/auth";
import CartaClient, { type CartaCategory, type CartaItem } from "./CartaClient";

export default async function CartaPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/ingresar");

  const profile = await getCurrentProfile();
  if (!profile?.bar_id) {
    return (
      <div style={{ padding: 32 }}>
        Tu cuenta no tiene un bar asociado.
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: cats }, { data: items }] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, sort")
      .eq("bar_id", profile.bar_id)
      .order("sort", { ascending: true }),
    supabase
      .from("menu_items")
      .select("id, category_id, name, description, price, station, active, photo_url, sort")
      .eq("bar_id", profile.bar_id)
      .order("sort", { ascending: true }),
  ]);

  const categories: CartaCategory[] = (cats ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    count: (items ?? []).filter((i) => i.category_id === c.id).length,
  }));

  const itemList: CartaItem[] = (items ?? []).map((i) => ({
    id: i.id,
    category_id: i.category_id,
    name: i.name,
    description: i.description ?? "",
    price: i.price,
    station: i.station,
    active: i.active,
    photo_url: i.photo_url,
  }));

  return <CartaClient categories={categories} items={itemList} />;
}
