"use client";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import type { ComponentProps } from "react";
import { fetchAdminOrderBundle } from "@/lib/admin-order-bundle-fetch";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/cn";

type Props = ComponentProps<typeof Link> & { orderId: string };

/** Prefetch кэша React Query при hover/focus (быстрый переход к карточке). */
export function PrefetchOrderLink({
  orderId,
  children,
  onMouseEnter,
  onFocus,
  className,
  ...rest
}: Props) {
  const queryClient = useQueryClient();

  const warm = () => {
    void queryClient.prefetchQuery({
      queryKey: queryKeys.adminOrder(orderId),
      queryFn: () => fetchAdminOrderBundle(orderId),
      staleTime: 60_000,
    });
  };

  return (
    <Link
      {...rest}
      className={cn(className, "cursor-pointer")}
      prefetch
      onMouseEnter={(e) => {
        warm();
        onMouseEnter?.(e);
      }}
      onFocus={(e) => {
        warm();
        onFocus?.(e);
      }}
    >
      {children}
    </Link>
  );
}
