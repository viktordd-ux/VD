import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { forbidden, requireStaff, requireUser } from "@/lib/api-auth";
import { getAccessibleOrganizationIds, getPrimaryOrganizationIdForUser } from "@/lib/org-scope";

/** GET /api/teams — команды в организациях текущего пользователя. ?organizationId= — фильтр по одной org (должна быть доступна). */
export async function GET(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const orgIds = await getAccessibleOrganizationIds(user.id);
  const q = new URL(req.url).searchParams.get("organizationId")?.trim();
  const scopeIds =
    q && orgIds.includes(q) ? [q] : orgIds.length > 0 ? orgIds : ([] as string[]);

  if (scopeIds.length === 0) {
    return NextResponse.json({ teams: [] });
  }

  const teams = await prisma.team.findMany({
    where: { organizationId: { in: scopeIds } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, organizationId: true },
  });

  return NextResponse.json({ teams });
}

/** POST /api/teams — создать команду (только admin приложения; org — primary или из body). */
export async function POST(req: Request) {
  const user = await requireStaff();
  if (user instanceof NextResponse) return user;

  let body: { name?: string; organizationId?: string | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Укажите название команды" }, { status: 400 });
  }

  const requestedOrg =
    typeof body.organizationId === "string" && body.organizationId.trim()
      ? body.organizationId.trim()
      : await getPrimaryOrganizationIdForUser(user.id);

  if (!requestedOrg) {
    return NextResponse.json(
      { error: "Нет организации: создайте организацию или укажите organizationId" },
      { status: 400 },
    );
  }

  const orgIds = await getAccessibleOrganizationIds(user.id);
  if (!orgIds.includes(requestedOrg)) {
    return forbidden();
  }

  const team = await prisma.team.create({
    data: { name, organizationId: requestedOrg },
    select: { id: true, name: true, organizationId: true },
  });

  return NextResponse.json({ team }, { status: 201 });
}
