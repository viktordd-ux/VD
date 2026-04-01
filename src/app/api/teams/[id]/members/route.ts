import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { forbidden, requireStaff } from "@/lib/api-auth";
import { getAccessibleOrganizationIds } from "@/lib/org-scope";

type Params = { params: Promise<{ id: string }> };

/** POST /api/teams/[id]/members — { userId }; пользователь должен быть участником той же организации. */
export async function POST(req: Request, { params }: Params) {
  const admin = await requireStaff();
  if (admin instanceof NextResponse) return admin;

  const { id: teamId } = await params;
  const orgIds = await getAccessibleOrganizationIds(admin.id);

  const team = await prisma.team.findFirst({
    where: { id: teamId, organizationId: { in: orgIds } },
    select: { id: true, organizationId: true },
  });
  if (!team) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { userId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  if (!userId) {
    return NextResponse.json({ error: "userId обязателен" }, { status: 400 });
  }

  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId: team.organizationId,
      },
    },
  });
  if (!membership) {
    return NextResponse.json(
      { error: "Пользователь не состоит в этой организации" },
      { status: 400 },
    );
  }

  try {
    const row = await prisma.teamMember.create({
      data: { teamId: team.id, userId },
      select: { id: true, teamId: true, userId: true },
    });
    return NextResponse.json({ member: row }, { status: 201 });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "P2002") {
      return NextResponse.json({ error: "Уже в команде" }, { status: 409 });
    }
    throw e;
  }
}
