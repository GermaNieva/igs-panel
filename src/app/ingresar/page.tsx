import LoginForm from "./LoginForm";

export default async function IngresarPage({
  searchParams,
}: {
  searchParams: Promise<{ modo?: string; next?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const mode = sp.modo === "registro" ? "signup" : "login";
  const next = sp.next && sp.next.startsWith("/") ? sp.next : "/dashboard";
  const initialError = sp.error
    ? decodeURIComponent(sp.error).replace(/\+/g, " ")
    : null;
  return <LoginForm initialMode={mode} next={next} initialError={initialError} />;
}
