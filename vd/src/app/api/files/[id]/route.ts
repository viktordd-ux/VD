import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { forbidden, requireUser } from "@/lib/api-auth";
import { absoluteFilePath } from "@/lib/uploads";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;

  const file = await prisma.file.findUnique({ where: { id } });
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const order = await prisma.order.findUnique({ where: { id: file.orderId } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (user.role === "executor" && order.executorId !== user.id) {
    return forbidden();
  }

  const abs = absoluteFilePath(file.filePath);
  try {
    const data = await fs.readFile(abs);
    const ext = path.extname(file.filePath).toLowerCase();
    const type =
      ext === ".pdf"
        ? "application/pdf"
        : ext === ".png"
          ? "image/png"
          : ext === ".jpg" || ext === ".jpeg"
            ? "image/jpeg"
            : "application/octet-stream";
    return new NextResponse(data, {
      headers: {
        "Content-Type": type,
        "Content-Disposition": `attachment; filename="${path.basename(file.filePath)}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }
}
