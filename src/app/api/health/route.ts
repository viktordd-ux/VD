import { NextResponse } from "next/server";

/** Публичная проверка: деплой на Vercel отвечает (без БД и сессии). */
export async function GET() {
  const vapidConfigured = Boolean(
    process.env.VAPID_PUBLIC_KEY?.trim() &&
      process.env.VAPID_PRIVATE_KEY?.trim(),
  );
  return NextResponse.json({
    ok: true,
    service: "vd",
    time: new Date().toISOString(),
    push: { vapidConfigured },
  });
}
