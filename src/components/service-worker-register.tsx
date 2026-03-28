"use client";

import { useEffect } from "react";
import { pushLogClient } from "@/lib/push-debug-client";
import { isSecureContextOrLocalhost } from "@/lib/pwa";

/** Ранняя регистрация SW (PWA + push), до экранов с подпиской на push. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!isSecureContextOrLocalhost()) {
      console.warn(
        "[SW] Service workers и Web Push требуют HTTPS (или localhost). Текущий origin небезопасен.",
      );
    }
    if (!("serviceWorker" in navigator)) {
      pushLogClient("serviceWorker API missing");
      return;
    }
    pushLogClient("registering /sw.js …");
    void navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        pushLogClient("SW registered", {
          scope: reg.scope,
          active: reg.active?.scriptURL ?? null,
          installing: reg.installing?.scriptURL ?? null,
          waiting: reg.waiting?.scriptURL ?? null,
        });
        reg.addEventListener("updatefound", () => {
          pushLogClient("SW updatefound");
        });
      })
      .catch((e: unknown) => {
        console.error("[push-debug] SW register failed", e);
      });
  }, []);

  return null;
}
