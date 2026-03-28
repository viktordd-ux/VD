import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";

export const runtime = "nodejs";

type Body = {
  endpoint?: string;
  /** Удалить все подписки пользователя и выключить push в профиле. */
  all?: boolean;
};

/** POST /api/push/unsubscribe — снять подписку(и) с backend. */
export async function POST(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  let body: Body = {};
  try {
    const text = await req.text();
    if (text.trim()) body = JSON.parse(text) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.all === true) {
    await prisma.pushSubscription.deleteMany({ where: { userId: user.id } });
    await prisma.user.update({
      where: { id: user.id },
      data: { pushEnabled: false },
    });
    return NextResponse.json({ ok: true });
  }

  const endpoint =
    typeof body.endpoint === "string" ? body.endpoint.trim() : "";
  if (!endpoint) {
    return NextResponse.json(
      { error: "Укажите endpoint или all: true" },
      { status: 400 },
    );
  }

  await prisma.pushSubscription.deleteMany({
    where: { userId: user.id, endpoint },
  });

  const remaining = await prisma.pushSubscription.count({
    where: { userId: user.id },
  });
  if (remaining === 0) {
    await prisma.user.update({
      where: { id: user.id },
      data: { pushEnabled: false },
    });
  }

  return NextResponse.json({ ok: true });
}
