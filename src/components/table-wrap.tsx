import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function TableWrap({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-x-auto rounded-2xl border border-[color:var(--border)] bg-[var(--card)] shadow-sm shadow-black/[0.04] dark:shadow-black/40",
        className,
      )}
    >
      {children}
    </div>
  );
}

export const thClass =
  "px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted)]";
export const tdClass =
  "px-4 py-3.5 align-middle text-[var(--text)] text-sm";
export const trClass =
  "border-b border-[color:var(--border)] transition-colors last:border-0 hover:bg-[color:var(--muted-bg)]";
