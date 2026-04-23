import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MiBarForm from "./MiBarForm";
import type { BarUpdate } from "./actions";

type Socials = Partial<BarUpdate["socials"]>;

export default async function MiBarPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("bar_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.bar_id) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Tu cuenta no tiene un bar asociado.</div>
        <div style={{ fontSize: 13, color: "#8c897f" }}>
          Cerrá sesión y volvé a registrarte usando &ldquo;Crear mi bar&rdquo; para que el sistema cree automáticamente tu bar.
        </div>
      </div>
    );
  }

  const { data: bar } = await supabase
    .from("bars")
    .select("name, tagline, welcome_msg, address, city, socials")
    .eq("id", profile.bar_id)
    .maybeSingle();

  const socials = (bar?.socials ?? {}) as Socials;

  const initial: BarUpdate = {
    name: bar?.name ?? "",
    tagline: bar?.tagline ?? "",
    welcome_msg: bar?.welcome_msg ?? "",
    address: bar?.address ?? "",
    city: bar?.city ?? "",
    socials: {
      instagram: socials.instagram ?? "",
      facebook: socials.facebook ?? "",
      whatsapp: socials.whatsapp ?? "",
      reservation_url: socials.reservation_url ?? "",
    },
  };

  return <MiBarForm initial={initial} />;
}
