import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { forbidden, requireUser } from "@/lib/api-auth";
import { orderIsActive } from "@/lib/active-scope";
import { writeAudit } from "@/lib/audit";
import { normalizeExternalUrl, saveOrderFile } from "@/lib/uploads";
import { revalidateOrderViews } from "@/lib/revalidate-app";
import {
  pushNotifyAdminsNewFile,
  pushNotifyExecutorOrderFile,
} from "@/lib/push-notify";
import { notifyExecutorChatMessage } from "@/lib/telegram-notify";

export const maxDuration = 60;

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
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(files);
}

export async function POST(req: Request, { params }: Params) {
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

  const uploadedBy = user.role === "admin" ? "admin" : "executor";
  const ct = req.headers.get("content-type") ?? "";

  if (ct.includes("application/json")) {
    let body: { externalUrl?: string; comment?: string | null; linkTitle?: string | null };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
    }
    const url = normalizeExternalUrl(String(body.externalUrl ?? ""));
    if (!url) {
      return NextResponse.json(
        { error: "Укажите корректную ссылку (http или https)" },
        { status: 400 },
      );
    }
    const comment = body.comment?.trim() ? body.comment.trim() : null;
    const linkTitle = body.linkTitle?.trim() ? body.linkTitle.trim() : null;

    let row: Awaited<ReturnType<typeof prisma.file.create>>;
    try {
      row = await prisma.file.create({
        data: {
          orderId,
          uploadedBy,
          kind: "link",
          filePath: null,
          externalUrl: url,
          linkTitle,
          comment,
        },
      });
    } catch (err) {
      console.error("[files/link] DB error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: `Ошибка базы данных: ${msg}` }, { status: 500 });
    }

    try {
      await writeAudit({
        entityType: "file",
        entityId: row.id,
        actionType: "upload",
        changedById: user.id,
        diff: { orderId, kind: "link", externalUrl: url },
      });
    } catch (err) {
      console.error("[files/link] Audit error (non-fatal):", err);
    }

    if (user.role === "admin" && order.executorId) {
      notifyExecutorChatMessage(order.executorId);
      pushNotifyExecutorOrderFile(order.executorId, order.title, orderId);
    }
    if (user.role === "executor") {
      pushNotifyAdminsNewFile(order.title, orderId);
    }

    revalidateOrderViews(orderId);
    return NextResponse.json(row);
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Не удалось разобрать форму" }, { status: 400 });
  }

  const file = formData.get("file");
  const comment = (formData.get("comment") as string | null) ?? null;

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Файл не выбран" }, { status: 400 });
  }

  let filePath: string;
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    filePath = await saveOrderFile(orderId, buf, file.name);
  } catch (err) {
    console.error("[files/upload] Supabase storage error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Ошибка хранилища: ${msg}` }, { status: 502 });
  }

  let row: Awaited<ReturnType<typeof prisma.file.create>>;
  try {
    row = await prisma.file.create({
      data: {
        orderId,
        uploadedBy,
        kind: "file",
        filePath,
        comment,
      },
    });
  } catch (err) {
    console.error("[files/upload] DB error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Ошибка базы данных: ${msg}` }, { status: 500 });
  }

  try {
    await writeAudit({
      entityType: "file",
      entityId: row.id,
      actionType: "upload",
      changedById: user.id,
      diff: { orderId, filePath },
    });
  } catch (err) {
    console.error("[files/upload] Audit write error (non-fatal):", err);
  }

  if (user.role === "admin" && order.executorId) {
    notifyExecutorChatMessage(order.executorId);
    pushNotifyExecutorOrderFile(order.executorId, order.title, orderId);
  }
  if (user.role === "executor") {
    pushNotifyAdminsNewFile(order.title, orderId);
  }

  revalidateOrderViews(orderId);
  return NextResponse.json(row);
}
