"use client";

import { SessionProvider } from "next-auth/react";
import { Suspense } from "react";
import { NavigationProgress } from "@/components/navigation-progress";
import { ToastProvider } from "@/components/toast-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider>
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        {children}
      </ToastProvider>
    </SessionProvider>
  );
}
