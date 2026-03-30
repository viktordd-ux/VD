import { Suspense } from "react";
import { PageLoadingSkeleton } from "@/components/page-loading-skeleton";
import { AdminOrderDetailClient } from "./admin-order-detail-client";

type Props = { params: Promise<{ id: string }> };

export default async function AdminOrderPage({ params }: Props) {
  const { id } = await params;
  return (
    <Suspense fallback={<PageLoadingSkeleton />}>
      <AdminOrderDetailClient orderId={id} />
    </Suspense>
  );
}
