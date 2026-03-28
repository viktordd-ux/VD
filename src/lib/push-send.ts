import webpush from "web-push";
import type { PushSubscription as DbPushSubscription } from "@prisma/client";
import prisma from "@/lib/prisma";
import { pushLogServer, vapidPublicFingerprint } from "@/lib/push-debug";

export type WebPushPayload = { title: string; body: string; url?: string };

let vapidConfigured = false;

function vapidPublicKey(): string | undefined {
  const k =
    process.env.VAPID_PUBLIC_KEY?.trim() ||
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  return k || undefined;
}

function endpointHost(endpoint: string): string {
  try {
    return new URL(endpoint).host;
  } catch {
    return "(invalid-endpoint)";
  }
}

function ensureVapidConfigured(): boolean {
  const publicKey = vapidPublicKey();
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  if (!vapidConfigured) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT ?? "mailto:admin@localhost",
      publicKey,
      privateKey,
    );
    vapidConfigured = true;
    pushLogServer(
      "vapid configured",
      "subject=",
      process.env.VAPID_SUBJECT ?? "mailto:admin@localhost",
      "publicFingerprint=",
      vapidPublicFingerprint(publicKey),
    );
  }
  return true;
}

export function isWebPushConfigured(): boolean {
  return Boolean(vapidPublicKey() && process.env.VAPID_PRIVATE_KEY);
}

export async function sendPushNotification(
  sub: DbPushSubscription,
  payload: WebPushPayload,
): Promise<{ ok: true } | { ok: false; remove: boolean }> {
  if (!ensureVapidConfigured()) {
    pushLogServer("send skip: VAPID not configured");
    return { ok: false, remove: false };
  }

  const pushSub = {
    endpoint: sub.endpoint,
    keys: { p256dh: sub.p256dh, auth: sub.auth },
  };

  const body = JSON.stringify(payload);
  pushLogServer(
    "send attempt",
    "subscriptionId=",
    sub.id,
    "endpointHost=",
    endpointHost(sub.endpoint),
    "payload=",
    { title: payload.title, url: payload.url ?? "(none)" },
  );

  try {
    await webpush.sendNotification(pushSub, body, {
      TTL: 86_400,
    });
    pushLogServer("send ok", "subscriptionId=", sub.id, "endpointHost=", endpointHost(sub.endpoint));
    return { ok: true };
  } catch (err: unknown) {
    const statusCode =
      typeof err === "object" && err !== null && "statusCode" in err
        ? (err as { statusCode?: number }).statusCode
        : undefined;
    const bodyText =
      typeof err === "object" && err !== null && "body" in err
        ? String((err as { body?: string }).body ?? "").slice(0, 200)
        : "";
    pushLogServer(
      "send error",
      "subscriptionId=",
      sub.id,
      "statusCode=",
      statusCode,
      "bodySnippet=",
      bodyText || "(none)",
      err,
    );
    if (statusCode === 410 || statusCode === 404) {
      await prisma.pushSubscription.deleteMany({ where: { id: sub.id } });
      pushLogServer("removed stale subscription", sub.id);
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
  if (!isWebPushConfigured()) {
    pushLogServer("sendPushToUser skip: VAPID keys missing");
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pushEnabled: true, pushSubscriptions: true },
  });
  if (!user) {
    pushLogServer("sendPushToUser skip: user not found", userId);
    return;
  }
  if (!user.pushEnabled) {
    pushLogServer("sendPushToUser skip: pushEnabled=false", userId);
    return;
  }
  if (user.pushSubscriptions.length === 0) {
    pushLogServer("sendPushToUser skip: no subscriptions", userId);
    return;
  }

  pushLogServer(
    "sendPushToUser",
    "userId=",
    userId,
    "subscriptions=",
    user.pushSubscriptions.length,
    "title=",
    payload.title,
  );

  await Promise.all(user.pushSubscriptions.map((sub) => sendPushNotification(sub, payload)));
}

export async function sendPushToAllAdmins(payload: WebPushPayload): Promise<void> {
  if (!isWebPushConfigured()) {
    pushLogServer("sendPushToAllAdmins skip: VAPID keys missing");
    return;
  }

  const admins = await prisma.user.findMany({
    where: { role: "admin", pushEnabled: true },
    select: { id: true },
  });
  pushLogServer("sendPushToAllAdmins", "adminsWithPush=", admins.length, "title=", payload.title);
  await Promise.all(admins.map((a) => sendPushToUser(a.id, payload)));
}
