import fs from "fs/promises";
import prisma from "@/lib/prisma";
import { absoluteFilePath } from "@/lib/uploads";

export async function hardDeleteOrderById(orderId: string): Promise<void> {
  const files = await prisma.file.findMany({
    where: { orderId },
    select: { filePath: true },
  });
  await prisma.order.delete({ where: { id: orderId } });
  for (const f of files) {
    try {
      await fs.unlink(absoluteFilePath(f.filePath));
    } catch {
      /* ignore */
    }
  }
  try {
    const dir = absoluteFilePath(`uploads/orders/${orderId}`);
    await fs.rm(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
