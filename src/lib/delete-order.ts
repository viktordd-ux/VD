import prisma from "@/lib/prisma";
import { deleteStorageFile, isStorageFileEntry } from "@/lib/uploads";

export async function hardDeleteOrderById(orderId: string): Promise<void> {
  const files = await prisma.file.findMany({
    where: { orderId },
    select: { kind: true, filePath: true },
  });
  await prisma.order.delete({ where: { id: orderId } });
  for (const f of files) {
    if (!isStorageFileEntry(f)) continue;
    try {
      await deleteStorageFile(f.filePath!);
    } catch {
      /* ignore */
    }
  }
}
