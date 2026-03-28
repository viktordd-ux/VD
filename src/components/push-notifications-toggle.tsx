"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/cn";

type Status = "idle" | "loading" | "error" | "success";

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function PushNotificationsToggle() {
  const [pushEnabled, setPushEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setSupported(false);
      return;
    }
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      setSupported(false);
    });
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/users/me");
        if (!res.ok) return;
        const me = (await res.json()) as { pushEnabled?: boolean };
        setPushEnabled(Boolean(me.pushEnabled));
      } catch {
        // ignore
      }
    })();
  }, []);

  const enable = useCallback(async () => {
    setStatus("idle");
    setMessage(null);
    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      setStatus("error");
      setMessage("Разрешите уведомления в настройках браузера");
      return;
    }

    const vapidRes = await fetch("/api/push/vapid-public-key");
    if (!vapidRes.ok) {
      setStatus("error");
      setMessage("Push не настроен на сервере (VAPID)");
      return;
    }
    const { publicKey } = (await vapidRes.json()) as { publicKey: string };

    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await reg.update();

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    const subJson = sub.toJSON();
    if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
      setStatus("error");
      setMessage("Не удалось создать подписку");
      return;
    }

    const save = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: subJson.endpoint,
        keys: { p256dh: subJson.keys.p256dh, auth: subJson.keys.auth },
      }),
    });

    if (!save.ok) {
      setStatus("error");
      setMessage("Не удалось сохранить подписку");
      return;
    }

    setPushEnabled(true);
    setStatus("success");
    setMessage(null);
    window.setTimeout(() => setStatus("idle"), 2000);
  }, []);

  const disable = useCallback(async () => {
    setStatus("idle");
    setMessage(null);
    try {
      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
    } catch {
      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
    }
    setPushEnabled(false);
    setStatus("success");
    window.setTimeout(() => setStatus("idle"), 2000);
  }, []);

  const onToggle = async () => {
    if (!supported || busy) return;
    setBusy(true);
    setStatus("loading");
    setMessage(null);
    try {
      if (pushEnabled) {
        await disable();
      } else {
        await enable();
      }
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  if (!supported) {
    return (
      <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-3 py-2.5 text-xs text-zinc-500">
        Push-уведомления в этом браузере недоступны
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-900">Уведомления</p>
          <p className="text-xs text-zinc-500">Push, в т.ч. при закрытом сайте</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={pushEnabled}
          disabled={busy}
          onClick={() => void onToggle()}
          className={cn(
            "relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400",
            pushEnabled ? "bg-emerald-600" : "bg-zinc-300",
            busy && "opacity-60",
          )}
        >
          <span
            className={cn(
              "pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow transition",
              pushEnabled ? "translate-x-5" : "translate-x-0.5",
            )}
          />
        </button>
      </div>
      {status === "loading" && (
        <p className="text-xs text-zinc-500">Сохранение…</p>
      )}
      {status === "success" && (
        <p className="text-xs text-emerald-700">Готово</p>
      )}
      {status === "error" && message && (
        <p className="text-xs text-red-600">{message}</p>
      )}
    </div>
  );
}
