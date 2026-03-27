"use client";

import { useEffect, useRef } from "react";
import { useAppToast } from "@/components/toast-provider";

const STORAGE_PREFIX = "vd_silence_toast_";

/** Polling тишины для админки: toast при новых срабатываниях (пороги из env на сервере). */
export function AdminSilenceAlerts() {
  const push = useAppToast();
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const seen = (id: string, level: string) => {
      try {
        return sessionStorage.getItem(`${STORAGE_PREFIX}${id}_${level}`) === "1";
      } catch {
        return false;
      }
    };
    const mark = (id: string, level: string) => {
      try {
        sessionStorage.setItem(`${STORAGE_PREFIX}${id}_${level}`, "1");
      } catch {
        /* ignore */
      }
    };

    async function poll() {
      const res = await fetch("/api/risks/silence-alerts");
      if (!res.ok || !mounted.current) return;
      const data = (await res.json()) as {
        alerts: { orderId: string; title: string; level: string }[];
      };
      for (const a of data.alerts) {
        if (seen(a.orderId, a.level)) continue;
        mark(a.orderId, a.level);
        const msg =
          a.level === "high"
            ? `Риск: долгая тишина — ${a.title}`
            : `Предупреждение: тишина — ${a.title}`;
        push(msg, a.level === "high" ? "error" : "info");
      }
    }

    void poll();
    const t = window.setInterval(poll, 120_000);
    return () => {
      mounted.current = false;
      window.clearInterval(t);
    };
  }, [push]);

  return null;
}
