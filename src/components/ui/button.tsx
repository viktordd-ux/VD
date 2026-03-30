import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "destructive" | "ghost";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  primary:
    "bg-zinc-900 text-white shadow-sm hover:bg-zinc-800 hover:scale-[1.01] active:scale-[0.98] active:bg-zinc-950 disabled:opacity-50 disabled:hover:scale-100 disabled:active:scale-100 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200",
  secondary:
    "border border-[color:var(--border)] bg-transparent text-[var(--text)] shadow-sm hover:bg-[color:var(--muted-bg)] hover:scale-[1.01] active:scale-[0.98] active:opacity-90 disabled:opacity-50 disabled:hover:scale-100 disabled:active:scale-100",
  destructive:
    "border border-red-200/80 bg-red-50 text-red-900 shadow-sm hover:bg-red-100/90 hover:scale-[1.01] active:scale-[0.98] active:bg-red-200/80 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100 dark:hover:bg-red-950/60",
  ghost:
    "text-[var(--text)] hover:bg-[color:var(--muted-bg)] hover:scale-[1.01] active:scale-[0.98] active:opacity-90 disabled:opacity-50 disabled:hover:scale-100 disabled:active:scale-100",
};

const sizes: Record<Size, string> = {
  sm: "min-h-11 px-3 py-2 text-xs font-medium",
  md: "min-h-11 px-4 py-2.5 text-sm font-medium",
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  loading = false,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center rounded-lg transition-all duration-150 ease-out will-change-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400 disabled:pointer-events-none",
        loading && "relative opacity-90",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2 opacity-90">
          <span
            className="inline-flex h-1 w-1 animate-pulse rounded-full bg-current opacity-70"
            aria-hidden
          />
          <span className="animate-pulse">{children}</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}
