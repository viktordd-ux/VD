/** Логи при старте Node (Vercel Functions): проверка обязательных env без вывода значений. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const missing: string[] = [];
  if (!process.env.DATABASE_URL?.trim()) missing.push("DATABASE_URL");
  if (!process.env.DIRECT_URL?.trim()) missing.push("DIRECT_URL");
  if (!process.env.AUTH_SECRET?.trim()) missing.push("AUTH_SECRET");
  if (missing.length > 0) {
    console.error("[vd] Missing required env (app will fail):", missing.join(", "));
  }
  if (process.env.VERCEL === "1" && !process.env.AUTH_URL?.trim()) {
    console.warn(
      "[vd] AUTH_URL is unset — set to https://<your-project>.vercel.app (or custom domain) for NextAuth cookies.",
    );
  }
}
