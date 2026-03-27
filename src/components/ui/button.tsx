import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "destructive" | "ghost";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  primary:
    "bg-zinc-900 text-white shadow-sm hover:bg-zinc-800 active:bg-zinc-950 disabled:opacity-50",
  secondary:
    "border border-zinc-300 bg-white text-zinc-800 shadow-sm hover:bg-zinc-50 active:bg-zinc-100 disabled:opacity-50",
  destructive:
    "border border-red-200 bg-red-50 text-red-900 shadow-sm hover:bg-red-100 active:bg-red-200 disabled:opacity-50",
  ghost:
    "text-zinc-700 hover:bg-zinc-100 active:bg-zinc-200 disabled:opacity-50",
};

const sizes: Record<Size, string> = {
  sm: "px-2.5 py-1.5 text-xs font-medium",
  md: "px-4 py-2 text-sm font-medium",
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
}) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
