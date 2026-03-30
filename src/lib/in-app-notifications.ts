import type { NotificationKind } from "@prisma/client";
import prisma from "@/lib/prisma";

export async function createInAppNotification(input: {
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  linkHref?: string | null;
}) {
  await prisma.notification.create({
    data: {
      userId: input.userId,
      kind: input.kind,
      title: input.title,
      body: input.body,
      linkHref: input.linkHref ?? null,
    },
  });
}

/** Уведомление всем активным админам (in-app). */
export async function createInAppNotificationForAdmins(input: {
  kind: NotificationKind;
  title: string;
  body: string;
  linkHref: string;
}) {
  const admins = await prisma.user.findMany({
    where: { role: "admin", status: "active" },
    select: { id: true },
  });
  if (admins.length === 0) return;
  await prisma.notification.createMany({
    data: admins.map((a) => ({
      userId: a.id,
      kind: input.kind,
      title: input.title,
      body: input.body,
      linkHref: input.linkHref,
    })),
  });
}
