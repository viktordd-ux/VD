import { MembershipRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { getExecutorMetricsMap } from "@/lib/executor-matching";
import { getAccessibleOrganizationIds } from "@/lib/org-scope";
import { dbUnavailableUserMessage } from "@/lib/db-unavailable-message";
import {
  AdminUsersListClient,
  type AdminExecutorListRow,
} from "./admin-users-list-client";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "admin") {
    redirect(session.user.role === "executor" ? "/executor" : "/login");
  }

  let initialRows: AdminExecutorListRow[] = [];
  let loadError: string | null = null;

  try {
    const orgIds = await getAccessibleOrganizationIds(session.user.id);

    const users = await prisma.user.findMany({
      where: {
        memberships: { some: { organizationId: { in: orgIds } } },
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        email: true,
        status: true,
        primarySkill: true,
        skills: true,
        onboarded: true,
        memberships: {
          where: { organizationId: { in: orgIds } },
          select: { organizationId: true, role: true },
        },
      },
    });
    const metrics = await getExecutorMetricsMap(users.map((u) => u.id), {
      organizationIds: orgIds,
    });

    initialRows = users.map((u) => {
      const m = metrics.get(u.id);
      const mem =
        orgIds
          .map((oid) => u.memberships.find((x) => x.organizationId === oid))
          .find(Boolean) ?? u.memberships[0];
      return {
        id: u.id,
        name: u.name,
        firstName: u.firstName ?? "",
        lastName: u.lastName ?? "",
        email: u.email,
        status: u.status,
        primarySkill: u.primarySkill,
        skills: u.skills,
        onboarded: u.onboarded,
        membershipRole: mem?.role ?? MembershipRole.VIEWER,
        rating: m?.rating ?? 0,
        completedOrders: m?.completedOrders ?? 0,
        latePercent: m?.latePercent ?? 0,
        avgResponseTime: m?.avgResponseTime ?? null,
      };
    });
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.error("[admin/users]", e);
    }
    loadError = dbUnavailableUserMessage(e);
  }

  return <AdminUsersListClient initialRows={initialRows} loadError={loadError} />;
}
