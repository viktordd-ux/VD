import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { writeAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const user = await requireAdmin();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(lead);
}

export async function PATCH(req: Request, { params }: Params) {
  const user = await requireAdmin();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  const existing = await prisma.lead.findUnique({ where: { id } });
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

export async function DELETE(_req: Request, { params }: Params) {
  const user = await requireAdmin();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  const existing = await prisma.lead.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.lead.delete({ where: { id } });

  await writeAudit({
    entityType: "lead",
    entityId: id,
    actionType: "delete",
    changedById: user.id,
    diff: { before: existing },
  });

  return NextResponse.json({ ok: true });
}
