import prisma from "@/lib/prisma";
import { getExecutorMetricsMap } from "@/lib/executor-matching";
import {
  AdminUsersListClient,
  type AdminExecutorListRow,
} from "./admin-users-list-client";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const users = await prisma.user.findMany({
    where: { role: "executor" },
    orderBy: { name: "asc" },
  });
  const metrics = await getExecutorMetricsMap(users.map((u) => u.id));

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
