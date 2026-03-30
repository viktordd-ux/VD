import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PageLoadingSkeleton } from "@/components/page-loading-skeleton";
import { ExecutorHomeClient } from "./executor-home-client";

export default async function ExecutorHome() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "executor") redirect("/admin");
  if (session.user.onboarded !== true) redirect("/executor/onboarding");

  return (
    <Suspense fallback={<PageLoadingSkeleton />}>
      <ExecutorHomeClient userId={session.user.id} />
    </Suspense>
  );
}
