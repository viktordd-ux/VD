"use client";

import { SessionProvider } from "next-auth/react";
import { Suspense } from "react";
import { IosPwaInstallBanner } from "@/components/ios-pwa-install-banner";
import { NavigationProgress } from "@/components/navigation-progress";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { ToastProvider } from "@/components/toast-provider";
import { ReactQueryProvider } from "@/providers/react-query-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ReactQueryProvider>
        <ToastProvider>
          <ServiceWorkerRegister />
          <IosPwaInstallBanner />
          <Suspense fallback={null}>
            <NavigationProgress />
          </Suspense>
          {children}
        </ToastProvider>
      </ReactQueryProvider>
    </SessionProvider>
  );
}
