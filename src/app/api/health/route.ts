import { NextResponse } from "next/server";

/** Публичная проверка: деплой на Vercel отвечает (без БД и сессии). */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "vd",
    time: new Date().toISOString(),
  });
}
