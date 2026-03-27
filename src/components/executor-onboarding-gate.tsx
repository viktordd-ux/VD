"use client";

import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

/** Syncs client navigations with middleware: executors must finish onboarding before the rest of /executor. */
export function ExecutorOnboardingGate() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) return;
    if (session.user.role !== "executor") return;

    const done = session.user.onboarded === true;
    const onOnboarding = pathname.startsWith("/executor/onboarding");

    if (!done && !onOnboarding) {
      router.replace("/executor/onboarding");
      return;
    }
    if (done && onOnboarding) {
      router.replace("/executor");
    }
  }, [session, status, pathname, router]);

  return null;
}
