import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { writeAudit } from "@/lib/audit";
import { hardDeleteLead, softDeleteLead } from "@/lib/deletion-ops";
import { leadIsActive } from "@/lib/active-scope";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const user = await requireAdmin();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  const lead = await prisma.lead.findFirst({ where: { id, ...leadIsActive } });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(lead);
}

export async function PATCH(req: Request, { params }: Params) {
  const user = await requireAdmin();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  const existing = await prisma.lead.findFirst({ where: { id, ...leadIsActive } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as Partial<{
    link: string;
    clientName: string;
    platform: string;
    text: string;
    notes: string | null;
    status: "NEW" | "IN_CHAT" | "WON" | "LOST";
  }>;

  const updated = await prisma.lead.update({
    where: { id },
    data: body,
  });

  await writeAudit({
    entityType: "lead",
    entityId: id,
    actionType: "update",
    changedById: user.id,
    diff: { before: existing, after: updated },
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: Request, { params }: Params) {
  const user = await requireAdmin();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const hard = searchParams.get("hard") === "true";

  try {
    if (hard) {
      await hardDeleteLead(id, user.id);
    } else {
      await softDeleteLead(id, user.id);
    }
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "NOT_FOUND") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (code === "LEAD_HAS_ORDERS") {
      return NextResponse.json(
        {
          error:
            "Нельзя скрыть лид: есть активные заказы. Удалите или отвяжите заказы, либо используйте удаление навсегда.",
        },
        { status: 409 },
      );
    }
    throw e;
  }

  return NextResponse.json({ ok: true, hard });
}
