import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { orderIsActive } from "@/lib/active-scope";
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
      executorId: { not: null },
      deadline: { not: null },
      status: { not: "DONE" },
    },
    select: {
      id: true,
      title: true,
      deadline: true,
      executorId: true,
    },
  });

  let tomorrowCount = 0;
  let overdueCount = 0;

  for (const o of orders) {
    if (!o.deadline || !o.executorId) continue;
    const dl = o.deadline;

    if (deadlineIsTomorrow(dl, now)) {
      notifyExecutorDeadlineTomorrow(o.executorId, o.title);
      tomorrowCount++;
      continue;
    }

    if (dl.getTime() < now.getTime()) {
      notifyExecutorOrderOverdue(o.executorId, o.title);
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
