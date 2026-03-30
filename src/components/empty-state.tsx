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
    <Card className="vd-fade-in border-dashed border-zinc-200/80 bg-zinc-50/50 py-16 text-center shadow-none transition-all duration-150 ease-out">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200/60">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold tracking-tight text-zinc-900">{title}</h3>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-500">{description}</p>
      ) : null}
      {action ? (
        <div className="mt-8 flex justify-center [&_button]:min-w-[11rem] [&_button]:transition-all [&_button]:duration-150 [&_button]:ease-out">
          {action}
        </div>
      ) : null}
    </Card>
  );
}
