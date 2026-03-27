import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { writeAudit } from "@/lib/audit";
import { syncNameFromProfile } from "@/lib/user-profile";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const { id } = await params;

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as Partial<{
    name: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    telegram: string | null;
    status: "active" | "banned";
    skills: string[];
    primarySkill: string;
    onboarded: boolean;
  }>;

  if (
    (body.skills !== undefined ||
      body.primarySkill !== undefined ||
      body.firstName !== undefined ||
      body.lastName !== undefined) &&
    existing.role !== "executor"
  ) {
    return NextResponse.json(
      { error: "Поля профиля исполнителя только для исполнителей" },
      { status: 400 },
    );
  }

  const skills =
    body.skills !== undefined
      ? body.skills.map((s) => String(s).trim()).filter(Boolean)
      : undefined;
  const firstName =
    body.firstName !== undefined ? String(body.firstName).trim() : undefined;
  const lastName =
    body.lastName !== undefined ? String(body.lastName).trim() : undefined;
  const phone =
    body.phone !== undefined
      ? body.phone === null || body.phone === ""
        ? null
        : String(body.phone).trim()
      : undefined;
  const telegram =
    body.telegram !== undefined
      ? body.telegram === null || body.telegram === ""
        ? null
        : String(body.telegram).trim()
      : undefined;
  const primarySkill =
    body.primarySkill !== undefined ? String(body.primarySkill).trim() : undefined;

  if (primarySkill !== undefined && skills !== undefined && !skills.includes(primarySkill)) {
    return NextResponse.json(
      { error: "Основной навык должен быть среди навыков" },
      { status: 400 },
    );
  }

  if (
    skills !== undefined &&
    primarySkill === undefined &&
    existing.role === "executor" &&
    existing.primarySkill &&
    !skills.includes(existing.primarySkill)
  ) {
    return NextResponse.json(
      { error: "Укажите основной навык или оставьте его в списке навыков" },
      { status: 400 },
    );
  }

  const resolvedName =
    existing.role === "executor"
      ? body.name !== undefined
        ? body.name
        : firstName !== undefined || lastName !== undefined
          ? syncNameFromProfile(
              firstName ?? existing.firstName,
              lastName ?? existing.lastName,
            )
          : undefined
      : body.name !== undefined
        ? body.name
        : undefined;

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(resolvedName !== undefined ? { name: resolvedName } : {}),
      status: body.status ?? undefined,
      ...(firstName !== undefined ? { firstName } : {}),
      ...(lastName !== undefined ? { lastName } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(telegram !== undefined ? { telegram } : {}),
      ...(skills !== undefined ? { skills } : {}),
      ...(primarySkill !== undefined ? { primarySkill } : {}),
      ...(body.onboarded !== undefined ? { onboarded: body.onboarded } : {}),
    },
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      status: true,
      phone: true,
      telegram: true,
      skills: true,
      primarySkill: true,
      onboarded: true,
    },
  });

  await writeAudit({
    entityType: "user",
    entityId: id,
    actionType: "update",
    changedById: admin.id,
    diff: { before: existing, after: updated },
  });

  return NextResponse.json(updated);
}
