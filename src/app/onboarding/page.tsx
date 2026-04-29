import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getCurrentProfile } from "@/lib/supabase/auth";
import OnboardingClient from "./OnboardingClient";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/ingresar");

  const profile = await getCurrentProfile();
  if (!profile?.bar_id) {
    return (
      <div style={{ padding: 32 }}>
        Tu cuenta no tiene un bar asociado. Cerrá sesión y volvé a registrarte.
      </div>
    );
  }
  if (!["owner", "super_admin"].includes(profile.role)) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const { data: bar } = await supabase
    .from("bars")
    .select("name, tagline, welcome_msg, address, city, onboarding_completed")
    .eq("id", profile.bar_id)
    .maybeSingle();

  if (!bar) redirect("/dashboard");
  if (bar.onboarding_completed) redirect("/dashboard");

  return (
    <OnboardingClient
      initialBar={{
        name: bar.name ?? "",
        tagline: bar.tagline ?? "",
        welcome_msg: bar.welcome_msg ?? "",
        address: bar.address ?? "",
        city: bar.city ?? "",
      }}
      ownerName={profile.full_name ?? user.email?.split("@")[0] ?? "Dueño"}
    />
  );
}
