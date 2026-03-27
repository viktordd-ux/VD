import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { deleteStorageFile } from "@/lib/uploads";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Удаляет файлы заказов, которые:
 * - завершены (status = DONE) более 24 часов назад
 * - или мягко удалены (deletedAt != null) более 24 часов назад
 *
 * Вызывается Vercel Cron раз в сутки.
 * Защищён заголовком Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 часа назад

  // Заказы, готовые к очистке файлов
  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { status: "DONE", updatedAt: { lt: cutoff } },
        { deletedAt: { not: null, lt: cutoff } },
      ],
    },
    select: { id: true, status: true, deletedAt: true },
  });

  if (orders.length === 0) {
    return NextResponse.json({ cleaned: 0, message: "Нечего удалять" });
  }

  const orderIds = orders.map((o) => o.id);

  // Все файлы этих заказов
  const files = await prisma.file.findMany({
    where: { orderId: { in: orderIds } },
    select: { id: true, filePath: true },
  });

  if (files.length === 0) {
    return NextResponse.json({ cleaned: 0, message: "Файлы уже удалены" });
  }

  let deleted = 0;
  let errors = 0;

  for (const file of files) {
    try {
      await deleteStorageFile(file.filePath);
    } catch {
      // Если файл уже удалён из хранилища — не страшно, продолжаем
      errors++;
    }

    try {
      await prisma.file.delete({ where: { id: file.id } });
      deleted++;
    } catch {
      errors++;
    }
  }

  console.log(`[cleanup] Deleted ${deleted} files, ${errors} errors. Orders: ${orderIds.length}`);

  return NextResponse.json({
    cleaned: deleted,
    errors,
    orders: orderIds.length,
  });
}
