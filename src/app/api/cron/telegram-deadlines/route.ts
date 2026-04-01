import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { orderIsActive } from "@/lib/active-scope";
import {
  pushNotifyExecutorDeadlineTomorrow,
  pushNotifyExecutorOrderOverdue,
} from "@/lib/push-notify";
import { getOrderExecutorUserIds } from "@/lib/order-executors";
import {
  notifyExecutorDeadlineTomorrow,
  notifyExecutorOrderOverdue,
} from "@/lib/telegram-notify";

export const runtime = "nodejs";
export const maxDuration = 60;

function utcDayStartMs(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Дедлайн попадает в календарный «завтра» (UTC). */
function deadlineIsTomorrow(deadline: Date, now: Date): boolean {
  const dlDay = utcDayStartMs(deadline);
  const tomorrowDay = utcDayStartMs(now) + 24 * 60 * 60 * 1000;
  return dlDay === tomorrowDay;
}

/**
 * Напоминания о дедлайне и просрочке в Telegram.
 * Vercel Cron + заголовок Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  const orders = await prisma.order.findMany({
    where: {
      ...orderIsActive,
      OR: [{ executorId: { not: null } }, { orderExecutors: { some: {} } }],
      deadline: { not: null },
      status: { not: "DONE" },
    },
    select: {
      id: true,
      title: true,
      deadline: true,
      executorId: true,
      orderExecutors: { select: { userId: true } },
    },
  });

  let tomorrowCount = 0;
  let overdueCount = 0;

  for (const o of orders) {
    if (!o.deadline) continue;
    const execIds = getOrderExecutorUserIds(o);
    if (execIds.length === 0) continue;
    const dl = o.deadline;

    if (deadlineIsTomorrow(dl, now)) {
      for (const uid of execIds) {
        notifyExecutorDeadlineTomorrow(uid, o.title);
        pushNotifyExecutorDeadlineTomorrow(uid, o.title, o.id);
      }
      tomorrowCount++;
      continue;
    }

    if (dl.getTime() < now.getTime()) {
      for (const uid of execIds) {
        notifyExecutorOrderOverdue(uid, o.title);
        pushNotifyExecutorOrderOverdue(uid, o.title, o.id);
      }
      overdueCount++;
    }
  }

  return NextResponse.json({
    ok: true,
    checked: orders.length,
    notifiedTomorrow: tomorrowCount,
    notifiedOverdue: overdueCount,
  });
}
