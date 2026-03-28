import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { forbidden, requireUser } from "@/lib/api-auth";
import { orderIsActive } from "@/lib/active-scope";

export const dynamic = "force-dynamic";

function canAccessOrder(
  role: "admin" | "executor",
  userId: string,
  order: { executorId: string | null },
): boolean {
  if (role === "admin") return true;
  return order.executorId === userId;
}

function maxDate(dates: (Date | null | undefined)[]): Date | null {
  let best: Date | null = null;
  for (const d of dates) {
    if (!d) continue;
    if (!best || d > best) best = d;
  }
  return best;
}

/** GET — есть ли непрочитанные сообщения от другой стороны или обновления по заказу (не чат). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const orderId = (await params).id;
  const order = await prisma.order.findFirst({
    where: { id: orderId, ...orderIsActive },
    select: { id: true, executorId: true, updatedAt: true },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessOrder(user.role, user.id, order)) return forbidden();

  const [state, latestOtherMsg, maxFile, maxCp] = await Promise.all([
    prisma.orderUserReadState.findUnique({
      where: { userId_orderId: { userId: user.id, orderId } },
    }),
    prisma.message.aggregate({
      where: { orderId, senderId: { not: user.id } },
      _max: { createdAt: true },
    }),
    prisma.file.aggregate({
      where: { orderId },
      _max: { createdAt: true },
    }),
    prisma.checkpoint.aggregate({
      where: { orderId },
      _max: { updatedAt: true },
    }),
  ]);

  const chatReadAt = state?.chatReadAt ?? null;
  const projectReadAt = state?.projectReadAt ?? null;

  const latestOtherAt = latestOtherMsg._max.createdAt;
  const hasUnreadChat =
    latestOtherAt != null &&
    (chatReadAt == null || latestOtherAt.getTime() > chatReadAt.getTime());

  const projectActivityAt = maxDate([
    order.updatedAt,
    maxFile._max.createdAt,
    maxCp._max.updatedAt,
  ]);
  const hasUnreadProject =
    projectActivityAt != null &&
    (projectReadAt == null ||
      projectActivityAt.getTime() > projectReadAt.getTime());

  return NextResponse.json({
    hasUnreadChat,
    hasUnreadProject,
    showBadge: hasUnreadChat || hasUnreadProject,
  });
}

/** PATCH — отметить чат и/или «страницу заказа» просмотренными. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const orderId = (await params).id;
  const order = await prisma.order.findFirst({
    where: { id: orderId, ...orderIsActive },
    select: { id: true, executorId: true },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessOrder(user.role, user.id, order)) return forbidden();

  let body: { markChat?: boolean; markProject?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const markChat = body.markChat === true;
  const markProject = body.markProject === true;
  if (!markChat && !markProject) {
    return NextResponse.json({ error: "markChat or markProject required" }, { status: 400 });
  }

  const now = new Date();

  await prisma.orderUserReadState.upsert({
    where: { userId_orderId: { userId: user.id, orderId } },
    create: {
      userId: user.id,
      orderId,
      chatReadAt: markChat ? now : null,
      projectReadAt: markProject ? now : null,
    },
    update: {
      ...(markChat ? { chatReadAt: now } : {}),
      ...(markProject ? { projectReadAt: now } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}
