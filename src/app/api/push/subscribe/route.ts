import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";

export const runtime = "nodejs";

type Body = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
};

/** POST /api/push/subscribe — сохранить подписку, включить push у пользователя. */
export async function POST(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const endpoint = typeof body.endpoint === "string" ? body.endpoint.trim() : "";
  const p256dh = typeof body.keys?.p256dh === "string" ? body.keys.p256dh.trim() : "";
  const auth = typeof body.keys?.auth === "string" ? body.keys.auth.trim() : "";

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { error: "endpoint и keys.p256dh, keys.auth обязательны" },
      { status: 400 },
    );
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      userId: user.id,
      endpoint,
      p256dh,
      auth,
    },
    update: {
      userId: user.id,
      p256dh,
      auth,
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { pushEnabled: true },
  });

  return NextResponse.json({ ok: true });
}
