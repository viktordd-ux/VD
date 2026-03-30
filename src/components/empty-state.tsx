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
    <Card className="vd-fade-in border-dashed border-[color:var(--border)] bg-[color:var(--muted-bg)] py-16 text-center shadow-none transition-all duration-150 ease-out dark:bg-[color:var(--muted-bg)]">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--elevate)] text-[var(--muted)] ring-1 ring-[color:var(--border)]">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold tracking-tight text-[var(--text)]">{title}</h3>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--muted)]">{description}</p>
      ) : null}
      {action ? (
        <div className="mt-8 flex justify-center [&_button]:min-w-[11rem] [&_button]:transition-all [&_button]:duration-150 [&_button]:ease-out">
          {action}
        </div>
      ) : null}
    </Card>
  );
}
