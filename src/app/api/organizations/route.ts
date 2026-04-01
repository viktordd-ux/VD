import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { MembershipRole } from "@prisma/client";

export async function POST(req: Request) {
  const sessionUser = await requireUser();
  if (sessionUser instanceof NextResponse) return sessionUser;

  let body: { name?: string };
  try {
    body = (await req.json()) as { name?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Укажите название организации" }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name,
        ownerId: sessionUser.id,
      },
    });
    await tx.membership.create({
      data: {
        userId: sessionUser.id,
        organizationId: org.id,
        role: MembershipRole.OWNER,
      },
    });
    return org;
  });

  return NextResponse.json({ organization: result }, { status: 201 });
}
