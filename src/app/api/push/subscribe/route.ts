import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { pushLogServer, vapidPublicFingerprint } from "@/lib/push-debug";

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

  const pub =
    process.env.VAPID_PUBLIC_KEY?.trim() ||
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  pushLogServer(
    "subscribe POST",
    "userId=",
    user.id,
    "endpointHost=",
    (() => {
      try {
        return new URL(endpoint).host;
      } catch {
        return "?";
      }
    })(),
    "vapidPublicFingerprint=",
    pub ? vapidPublicFingerprint(pub) : "(no public key env)",
  );

  try {
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
    pushLogServer("subscribe saved", "userId=", user.id, "endpoint upsert ok");
  } catch (e) {
    console.error("[push/subscribe]", e);
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2021") {
        return NextResponse.json(
          {
            error:
              "В базе нет таблицы подписок. Примените миграции (prisma migrate deploy к продовой БД).",
          },
          { status: 500 },
        );
      }
    }
    return NextResponse.json(
      { error: "Ошибка сохранения подписки в базе" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
