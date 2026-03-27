import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { writeAudit } from "@/lib/audit";

export async function GET() {
  const user = await requireAdmin();
  if (user instanceof NextResponse) return user;

  const leads = await prisma.lead.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(leads);
}

export async function POST(req: Request) {
  const user = await requireAdmin();
  if (user instanceof NextResponse) return user;

  const body = (await req.json()) as {
    link?: string;
    clientName?: string;
    platform?: string;
    text?: string;
    notes?: string;
    status?: string;
  };

  if (!body.link || !body.clientName || !body.platform || !body.text) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const lead = await prisma.lead.create({
    data: {
      link: body.link,
      clientName: body.clientName,
      platform: body.platform,
      text: body.text,
      notes: body.notes ?? null,
      status: (body.status as "NEW" | "IN_CHAT" | "WON" | "LOST") ?? "NEW",
    },
  });

  await writeAudit({
    entityType: "lead",
    entityId: lead.id,
    actionType: "create",
    changedById: user.id,
    diff: { after: lead },
  });

  return NextResponse.json(lead);
}
