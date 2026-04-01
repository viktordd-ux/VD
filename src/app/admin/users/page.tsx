import { redirect } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { getExecutorMetricsMap } from "@/lib/executor-matching";
import { getAccessibleOrganizationIds } from "@/lib/org-scope";
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
  const orgIds = await getAccessibleOrganizationIds(session.user.id);

  const users = await prisma.user.findMany({
    where: {
      role: "executor",
      memberships: { some: { organizationId: { in: orgIds } } },
    },
    orderBy: { name: "asc" },
  });
  const metrics = await getExecutorMetricsMap(users.map((u) => u.id), {
    organizationIds: orgIds,
  });

  const initialRows: AdminExecutorListRow[] = users.map((u) => {
    const m = metrics.get(u.id);
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
      rating: m?.rating ?? 0,
      completedOrders: m?.completedOrders ?? 0,
      latePercent: m?.latePercent ?? 0,
      avgResponseTime: m?.avgResponseTime ?? null,
    };
  });

  return <AdminUsersListClient initialRows={initialRows} />;
}
