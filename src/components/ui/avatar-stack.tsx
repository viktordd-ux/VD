import { Children, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Перекрывающиеся аватары (как в Linear): последний в DOM — слева визуально.
 */
export function AvatarStack({
  children,
  className,
  size = "md",
}: {
  children: ReactNode;
  className?: string;
  size?: "sm" | "md";
}) {
  const overlap = size === "sm" ? "-ml-2" : "-ml-2.5";
  const arr = Children.toArray(children);
  return (
    <div className={cn("flex items-center", className)}>
      {arr.map((child, i) => (
        <span
          key={i}
          className={cn(
            "relative inline-flex first:ml-0",
            i > 0 && overlap,
            "ring-2 ring-[var(--card)]",
          )}
          style={{ zIndex: arr.length - i }}
        >
          {child}
        </span>
      ))}
    </div>
  );
}
