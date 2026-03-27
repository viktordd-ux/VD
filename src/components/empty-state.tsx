import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Card className="border-dashed border-zinc-200 bg-zinc-50/60 py-14 text-center shadow-none">
      <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600">{description}</p>
      ) : null}
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </Card>
  );
}
