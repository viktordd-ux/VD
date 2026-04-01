"use client";

import { SessionProvider } from "next-auth/react";
import { IosPwaInstallBanner } from "@/components/ios-pwa-install-banner";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { ToastProvider } from "@/components/toast-provider";
import { ReactQueryProvider } from "@/providers/react-query-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { NavBadgesSync } from "@/components/nav-badges-sync";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <ReactQueryProvider>
          <NavBadgesSync />
          <ToastProvider>
            <ServiceWorkerRegister />
            <IosPwaInstallBanner />
            {children}
          </ToastProvider>
        </ReactQueryProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
