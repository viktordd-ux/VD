import JSZip from "jszip";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { forbidden, requireUser } from "@/lib/api-auth";
import { orderIsActive } from "@/lib/active-scope";
import {
  displayFileEntryLabel,
  downloadFileBuffer,
  displayFilename,
  isStorageFileEntry,
} from "@/lib/uploads";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id: orderId } = await params;

  const order = await prisma.order.findFirst({
    where: { id: orderId, ...orderIsActive },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (user.role === "executor" && order.executorId !== user.id) {
    return forbidden();
  }

  const files = await prisma.file.findMany({
    where: { orderId },
    orderBy: { createdAt: "asc" },
  });

  if (files.length === 0) {
    return NextResponse.json({ error: "Нет файлов" }, { status: 404 });
  }

  const zip = new JSZip();

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const label = displayFileEntryLabel(f);
    const baseName = `${String(i + 1).padStart(3, "0")}_${f.uploadedBy}_${label.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 80)}`;

    if (f.kind === "link" && f.externalUrl) {
      zip.file(
        `${baseName}.url.txt`,
        `${f.linkTitle ? `${f.linkTitle}\n` : ""}${f.externalUrl}${f.comment ? `\n\n${f.comment}` : ""}`,
      );
      continue;
    }

    if (!isStorageFileEntry(f) || !f.filePath) {
      zip.file(`${baseName}.txt`, "Нет данных файла");
      continue;
    }

    const name = `${baseName}_${displayFilename(f.filePath)}`;
    try {
      const buf = await downloadFileBuffer(f.filePath);
      zip.file(name, buf);
    } catch {
      zip.file(`${name}.txt`, `Файл недоступен: ${f.filePath}`);
    }
  }

  const body = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const filename = `order-${orderId.slice(0, 8)}-files.zip`;

  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
