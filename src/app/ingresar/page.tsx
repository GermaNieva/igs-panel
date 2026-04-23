import LoginForm from "./LoginForm";

export default async function IngresarPage({
  searchParams,
}: {
  searchParams: Promise<{ modo?: string; next?: string }>;
}) {
  const sp = await searchParams;
  const mode = sp.modo === "registro" ? "signup" : "login";
  const next = sp.next && sp.next.startsWith("/") ? sp.next : "/dashboard";
  return <LoginForm initialMode={mode} next={next} />;
}
