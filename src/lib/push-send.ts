import webpush from "web-push";
import type { PushSubscription as DbPushSubscription } from "@prisma/client";
import prisma from "@/lib/prisma";

export type WebPushPayload = { title: string; body: string; url?: string };

let vapidConfigured = false;

function ensureVapidConfigured(): boolean {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  if (!vapidConfigured) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT ?? "mailto:admin@localhost",
      publicKey,
      privateKey,
    );
    vapidConfigured = true;
  }
  return true;
}

export function isWebPushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export async function sendPushNotification(
  sub: DbPushSubscription,
  payload: WebPushPayload,
): Promise<{ ok: true } | { ok: false; remove: boolean }> {
  if (!ensureVapidConfigured()) return { ok: false, remove: false };

  const pushSub = {
    endpoint: sub.endpoint,
    keys: { p256dh: sub.p256dh, auth: sub.auth },
  };

  try {
    await webpush.sendNotification(pushSub, JSON.stringify(payload), {
      TTL: 86_400,
    });
    return { ok: true };
  } catch (err: unknown) {
    const statusCode =
      typeof err === "object" && err !== null && "statusCode" in err
        ? (err as { statusCode?: number }).statusCode
        : undefined;
    if (statusCode === 410 || statusCode === 404) {
      await prisma.pushSubscription.deleteMany({ where: { id: sub.id } });
      return { ok: false, remove: true };
    }
    console.error("[push] send failed", statusCode, err);
    return { ok: false, remove: false };
  }
}

export async function sendPushToUser(
  userId: string,
  payload: WebPushPayload,
): Promise<void> {
  if (!isWebPushConfigured()) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pushEnabled: true, pushSubscriptions: true },
  });
  if (!user?.pushEnabled || user.pushSubscriptions.length === 0) return;

  await Promise.all(user.pushSubscriptions.map((sub) => sendPushNotification(sub, payload)));
}

export async function sendPushToAllAdmins(payload: WebPushPayload): Promise<void> {
  if (!isWebPushConfigured()) return;

  const admins = await prisma.user.findMany({
    where: { role: "admin", pushEnabled: true },
    select: { id: true },
  });
  await Promise.all(admins.map((a) => sendPushToUser(a.id, payload)));
}
