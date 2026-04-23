import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CartaCliente, { type PublicBar, type PublicCategory, type PublicItem } from "../CartaCliente";

export default async function CartaGeneralPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await loadBarCarta(slug);
  if (!data) notFound();
  return <CartaCliente bar={data.bar} categories={data.categories} items={data.items} mesa={null} />;
}

export async function loadBarCarta(slug: string): Promise<{
  bar: PublicBar;
  categories: PublicCategory[];
  items: PublicItem[];
} | null> {
  const supabase = await createClient();
  const { data: bar } = await supabase
    .from("bars")
    .select("id, slug, name, tagline, welcome_msg, address, city, socials, plan_status")
    .eq("slug", slug)
    .maybeSingle();

  if (!bar) return null;
  if (!["trialing", "active"].includes(bar.plan_status)) {
    return null;
  }

  const [{ data: categories }, { data: items }] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, sort")
      .eq("bar_id", bar.id)
      .order("sort", { ascending: true }),
    supabase
      .from("menu_items")
      .select("id, category_id, name, description, price, photo_url, sort")
      .eq("bar_id", bar.id)
      .eq("active", true)
      .order("sort", { ascending: true }),
  ]);

  return {
    bar: {
      id: bar.id,
      slug: bar.slug,
      name: bar.name,
      tagline: bar.tagline,
      welcome_msg: bar.welcome_msg,
      address: bar.address,
      city: bar.city,
      socials: (bar.socials ?? {}) as PublicBar["socials"],
    },
    categories: (categories ?? []).map((c) => ({ id: c.id, name: c.name })),
    items: (items ?? []).map((i) => ({
      id: i.id,
      category_id: i.category_id,
      name: i.name,
      description: i.description ?? "",
      price: i.price,
      photo_url: i.photo_url,
    })),
  };
}
