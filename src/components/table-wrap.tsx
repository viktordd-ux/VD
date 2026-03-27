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
        "overflow-x-auto rounded-2xl border border-zinc-200/90 bg-white shadow-sm shadow-zinc-950/[0.04]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export const thClass =
  "px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500";
export const tdClass = "px-4 py-3.5 align-middle";
export const trClass =
  "border-b border-zinc-50 transition-colors last:border-0 hover:bg-zinc-50/70";
