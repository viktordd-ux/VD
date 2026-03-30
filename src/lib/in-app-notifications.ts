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
