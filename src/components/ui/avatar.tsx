import { cn } from "@/lib/cn";
import { AVATAR_PALETTE, avatarColorIndex } from "@/lib/avatar-colors";

export function initialsFromName(name: string | null | undefined): string {
  const t = name?.trim();
  if (!t) return "?";
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return t.slice(0, 2).toUpperCase();
}

type Size = "sm" | "md" | "lg";

const sizes: Record<Size, string> = {
  sm: "h-7 w-7 text-[10px]",
  md: "h-9 w-9 text-[11px]",
  lg: "h-11 w-11 text-sm",
};

export function Avatar({
  name,
  seed,
  src,
  size = "md",
  className,
  ringClassName,
}: {
  name: string | null | undefined;
  /** Для цвета; по умолчанию name или «?». */
  seed?: string;
  src?: string | null;
  size?: Size;
  className?: string;
  /** Например ring-2 ring-[var(--card)] для стека. */
  ringClassName?: string;
}) {
  const label = initialsFromName(name);
  const colorKey = seed ?? name ?? "?";
  const palette = AVATAR_PALETTE[avatarColorIndex(colorKey)];

  if (src) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700",
          sizes[size],
          ringClassName,
          className,
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="h-full w-full object-cover" />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold tracking-tight",
        sizes[size],
        palette,
        ringClassName,
        className,
      )}
      aria-hidden
    >
      {label.slice(0, 2)}
    </span>
  );
}
