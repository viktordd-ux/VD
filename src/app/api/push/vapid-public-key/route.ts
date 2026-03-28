import { NextResponse } from "next/server";
import { vapidPublicFingerprint } from "@/lib/push-debug";

/** Публичный VAPID-ключ для PushManager.subscribe (без секрета). */
export async function GET() {
  const publicKey =
    process.env.VAPID_PUBLIC_KEY?.trim() ||
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  if (!publicKey) {
    return NextResponse.json(
      { error: "Push не настроен на сервере" },
      { status: 503 },
    );
  }
  const trimmed = publicKey.trim();
  return NextResponse.json({
    publicKey: trimmed,
    /** Совпадает с логами сервера при PUSH_DEBUG (subscribe / send). */
    publicKeyFingerprint: vapidPublicFingerprint(trimmed),
  });
}
