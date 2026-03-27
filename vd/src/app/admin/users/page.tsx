import prisma from "@/lib/prisma";
import { getExecutorMetricsMap } from "@/lib/executor-matching";
import { CreateExecutorDialog } from "@/components/create-executor-dialog";
import { ExecutorSkillsEditor } from "./ui";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const users = await prisma.user.findMany({
    where: { role: "executor" },
    orderBy: { name: "asc" },
  });
  const metrics = await getExecutorMetricsMap(users.map((u) => u.id));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Исполнители</h1>
        <CreateExecutorDialog />
      </div>
      <p className="text-sm text-zinc-600">
        Score: учёт просрочек по завершённым заказам, средней скорости и суммарной прибыли (0–100).
      </p>
      <div className="space-y-4">
        {users.map((u) => (
          <ExecutorSkillsEditor
            key={u.id}
            user={u}
            score={metrics.get(u.id)?.score}
          />
        ))}
      </div>
    </div>
  );
}
