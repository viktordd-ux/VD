import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store, must-revalidate" };

/** GET /api/notifications — список уведомлений текущего пользователя. */
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    if (user instanceof NextResponse) return user;

    const sp = new URL(req.url).searchParams;
    const onlyUnread =
      sp.get("onlyUnread") === "true" ||
      sp.get("onlyUnread") === "1" ||
      sp.get("unread") === "1";

    const rows = await prisma.notification.findMany({
      where: {
        userId: user.id,
        ...(onlyUnread ? { readAt: null } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 25,
    });

    return NextResponse.json(
      {
        notifications: rows.map((n) => ({
          id: n.id,
          kind: n.kind,
          title: n.title,
          body: n.body,
          linkHref: n.linkHref,
          readAt: n.readAt?.toISOString() ?? null,
          createdAt: n.createdAt.toISOString(),
        })),
      },
      { headers: noStore },
    );
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.error("[api/notifications GET]", e);
    }
    return NextResponse.json(
      { error: "notifications_load_failed", notifications: [] },
      { status: 500, headers: noStore },
    );
  }
}

/** PATCH /api/notifications — { ids?: string[], readAll?: boolean } */
export async function PATCH(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const body = (await req.json().catch(() => ({}))) as {
    ids?: string[];
    readAll?: boolean;
    /** Пометить прочитанными уведомления, у которых в ссылке встречается id заказа (чат/заказ). */
    orderId?: string;
  };

  const now = new Date();

  if (typeof body.orderId === "string" && body.orderId.trim()) {
    const oid = body.orderId.trim();
    await prisma.notification.updateMany({
      where: {
        userId: user.id,
        readAt: null,
        linkHref: { contains: oid },
      },
      data: { readAt: now },
    });
    return NextResponse.json({ ok: true }, { headers: noStore });
  }

  if (body.readAll) {
    await prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: now },
    });
    return NextResponse.json({ ok: true }, { headers: noStore });
  }

  const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "ids or readAll required" }, { status: 400 });
  }

  await prisma.notification.updateMany({
    where: { userId: user.id, id: { in: ids } },
    data: { readAt: now },
  });

  return NextResponse.json({ ok: true }, { headers: noStore });
}
