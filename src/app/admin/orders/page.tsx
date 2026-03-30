import { Suspense } from "react";
import { PageLoadingSkeleton } from "@/components/page-loading-skeleton";
import { AdminOrdersPageClient } from "./admin-orders-page-client";

export default function OrdersPage() {
  return (
    <Suspense fallback={<PageLoadingSkeleton />}>
      <AdminOrdersPageClient />
    </Suspense>
  );
}
