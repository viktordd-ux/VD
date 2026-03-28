import { NextResponse } from "next/server";

/** Публичный VAPID-ключ для PushManager.subscribe (без секрета). */
export async function GET() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey?.trim()) {
    return NextResponse.json(
      { error: "Push не настроен на сервере" },
      { status: 503 },
    );
  }
  return NextResponse.json({ publicKey: publicKey.trim() });
}
