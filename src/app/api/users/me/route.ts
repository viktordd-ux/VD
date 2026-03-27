import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { syncNameFromProfile } from "@/lib/user-profile";

const userPublicSelect = {
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
  createdAt: true,
  updatedAt: true,
} as const;

export async function GET() {
  const sessionUser = await requireUser();
  if (sessionUser instanceof NextResponse) return sessionUser;

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: userPublicSelect,
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(user);
}

function validateOnboardingPayload(input: {
  firstName: string;
  lastName: string;
  phone: string | null | undefined;
  telegram: string | null | undefined;
  skills: string[];
  primarySkill: string;
}): string | null {
  if (!input.firstName?.trim() || !input.lastName?.trim()) {
    return "Укажите имя и фамилию";
  }
  const phone = input.phone?.trim() ?? "";
  const telegram = input.telegram?.trim() ?? "";
  if (!phone && !telegram) {
    return "Укажите телефон или Telegram";
  }
  if (!input.skills?.length) {
    return "Выберите хотя бы один навык";
  }
  const p = input.primarySkill?.trim() ?? "";
  if (!p) {
    return "Выберите основной навык";
  }
  const skillSet = new Set(input.skills.map((s) => s.trim()).filter(Boolean));
  if (!skillSet.has(p)) {
    return "Основной навык должен быть среди выбранных навыков";
  }
  return null;
}

export async function PATCH(req: Request) {
  const sessionUser = await requireUser();
  if (sessionUser instanceof NextResponse) return sessionUser;

  const body = (await req.json()) as Partial<{
    firstName: string;
    lastName: string;
    phone: string | null;
    telegram: string | null;
    skills: string[];
    primarySkill: string;
    onboarded: boolean;
  }>;

  const existing = await prisma.user.findUnique({ where: { id: sessionUser.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const skills =
    body.skills !== undefined
      ? body.skills.map((s) => String(s).trim()).filter(Boolean)
      : undefined;

  const firstName = body.firstName !== undefined ? String(body.firstName).trim() : undefined;
  const lastName = body.lastName !== undefined ? String(body.lastName).trim() : undefined;
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
  const onboarded = body.onboarded;

  if (onboarded === true) {
    const err = validateOnboardingPayload({
      firstName: firstName ?? existing.firstName,
      lastName: lastName ?? existing.lastName,
      phone: phone !== undefined ? phone : existing.phone,
      telegram: telegram !== undefined ? telegram : existing.telegram,
      skills: skills ?? existing.skills,
      primarySkill: primarySkill ?? existing.primarySkill,
    });
    if (err) return NextResponse.json({ error: err }, { status: 400 });
  }

  if (primarySkill !== undefined && skills !== undefined && !skills.includes(primarySkill)) {
    return NextResponse.json(
      { error: "Основной навык должен быть среди выбранных навыков" },
      { status: 400 },
    );
  }

  if (
    primarySkill !== undefined &&
    skills === undefined &&
    existing.skills.length > 0 &&
    !existing.skills.includes(primarySkill)
  ) {
    return NextResponse.json(
      { error: "Основной навык должен быть среди выбранных навыков" },
      { status: 400 },
    );
  }

  let name: string | undefined;
  if (firstName !== undefined || lastName !== undefined) {
    const fn = firstName ?? existing.firstName;
    const ln = lastName ?? existing.lastName;
    name = syncNameFromProfile(fn, ln);
  }

  const updated = await prisma.user.update({
    where: { id: sessionUser.id },
    data: {
      ...(firstName !== undefined ? { firstName } : {}),
      ...(lastName !== undefined ? { lastName } : {}),
      ...(name !== undefined ? { name } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(telegram !== undefined ? { telegram } : {}),
      ...(skills !== undefined ? { skills } : {}),
      ...(primarySkill !== undefined ? { primarySkill } : {}),
      ...(onboarded !== undefined ? { onboarded } : {}),
    },
    select: userPublicSelect,
  });

  return NextResponse.json(updated);
}
