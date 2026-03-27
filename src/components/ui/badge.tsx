import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone =
  | "neutral"
  | "progress"
  | "review"
  | "success"
  | "warning"
  | "danger";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-zinc-100 text-zinc-800 ring-1 ring-zinc-200/80",
  progress: "bg-blue-50 text-blue-900 ring-1 ring-blue-200/80",
  review: "bg-amber-50 text-amber-950 ring-1 ring-amber-200/80",
  success: "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200/80",
  warning: "bg-amber-50 text-amber-950 ring-1 ring-amber-200/80",
  danger: "bg-red-50 text-red-900 ring-1 ring-red-200/80",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
