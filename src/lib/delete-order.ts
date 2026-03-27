import prisma from "@/lib/prisma";
import { deleteStorageFile } from "@/lib/uploads";

export async function hardDeleteOrderById(orderId: string): Promise<void> {
  const files = await prisma.file.findMany({
    where: { orderId },
    select: { filePath: true },
  });
  await prisma.order.delete({ where: { id: orderId } });
  for (const f of files) {
    try {
      await deleteStorageFile(f.filePath);
    } catch {
      /* ignore */
    }
  }
}
