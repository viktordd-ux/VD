import type { Prisma } from "@prisma/client";

export type ChatAttachment = {
  type: "file";
  fileId: string;
  name: string;
  /** С клиента при загрузке; в БД опционально — для превью image/* без эвристики по имени. */
  mime?: string;
};

export function parseChatAttachmentsJson(value: unknown): ChatAttachment[] {
  if (!Array.isArray(value)) return [];
  const out: ChatAttachment[] = [];
  for (const x of value) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    if (o.type !== "file") continue;
    const fileId = o.fileId != null ? String(o.fileId) : "";
    const name = o.name != null ? String(o.name) : "файл";
    if (!fileId) continue;
    const mime =
      o.mime != null && typeof o.mime === "string" ? o.mime.trim() : undefined;
    out.push({ type: "file", fileId, name, ...(mime ? { mime } : {}) });
  }
  return out;
}

export function toPrismaAttachmentsJson(
  list: ChatAttachment[],
): Prisma.InputJsonValue {
  return list as unknown as Prisma.InputJsonValue;
}

export function mergeAttachmentsByFileId(
  a: ChatAttachment[],
  b: ChatAttachment[],
): ChatAttachment[] {
  const map = new Map<string, ChatAttachment>();
  for (const x of a) map.set(x.fileId, x);
  for (const x of b) map.set(x.fileId, x);
  return [...map.values()];
}
