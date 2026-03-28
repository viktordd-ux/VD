import { NextResponse } from "next/server";

/** Публичная проверка: деплой на Vercel отвечает (без БД и сессии). */
export async function GET() {
  const vapidConfigured = Boolean(
    process.env.VAPID_PUBLIC_KEY?.trim() &&
      process.env.VAPID_PRIVATE_KEY?.trim(),
  );

  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());
  const hasDirectUrl = Boolean(process.env.DIRECT_URL?.trim());
  const hasAuthSecret = Boolean(process.env.AUTH_SECRET?.trim());
  const hasAuthUrl = Boolean(process.env.AUTH_URL?.trim());
  const hasPublicSupabase = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  );

  const missingCritical: string[] = [];
  if (!hasDatabaseUrl) missingCritical.push("DATABASE_URL");
  if (!hasDirectUrl) missingCritical.push("DIRECT_URL");
  if (!hasAuthSecret) missingCritical.push("AUTH_SECRET");

  return NextResponse.json({
    ok: true,
    deployReady: missingCritical.length === 0,
    service: "vd",
    time: new Date().toISOString(),
    push: { vapidConfigured },
    env: {
      hasDatabaseUrl,
      hasDirectUrl,
      hasAuthSecret,
      hasAuthUrl,
      hasPublicSupabase,
    },
    missingCritical: missingCritical.length > 0 ? missingCritical : undefined,
  });
}
