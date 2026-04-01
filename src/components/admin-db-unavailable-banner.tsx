import { Card } from "@/components/ui/card";

export function AdminDbUnavailableBanner({
  message,
  title = "Нет связи с базой данных",
}: {
  message: string;
  title?: string;
}) {
  return (
    <Card className="border-amber-500/30 bg-amber-500/[0.06] p-5 dark:bg-amber-950/25">
      <p className="font-medium text-[var(--text)]">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{message}</p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
        <li>
          В Vercel → Settings → Environment Variables задайте тот же{" "}
          <code className="rounded bg-[color:var(--muted-bg)] px-1">DATABASE_URL</code>, что в Supabase
          (Postgres).
        </li>
        <li>
          Для миграций обычно нужен{" "}
          <code className="rounded bg-[color:var(--muted-bg)] px-1">DIRECT_URL</code> на прямой порт
          5432, не pooler.
        </li>
        <li>
          После смены строки подключения выполните миграции к этой базе и сделайте Redeploy.
        </li>
      </ul>
    </Card>
  );
}
