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

/** Почему window.PushManager может отсутствовать: Safari iOS в обычной вкладке, старый Safari, приватный режим. */
function getPushBrowserHint(): string {
  if (typeof navigator === "undefined") {
    return "Откройте сайт в Chrome, Edge или Firefox.";
  }
  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && (navigator.maxTouchPoints ?? 0) > 1);
  const isWebKitSafari =
    /Safari/i.test(ua) &&
    !/CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|Chrome\/|Android/.test(ua);

  if (isIOS) {
    return (
      "В обычной вкладке Safari на iPhone push недоступен. " +
      "Откройте сайт с иконки на главном экране (нужен iOS 16.4+). " +
      "Если уже открыли с экрана «Домой» и всё равно ошибка — обновите iOS или попробуйте Chrome из App Store."
    );
  }
  if (isWebKitSafari) {
    return (
      "В Safari на Mac нужен Safari 16.1+ (macOS Ventura и новее). " +
      "Или используйте Chrome / Edge / Firefox."
    );
  }
  return "Этот браузер не поддерживает Web Push. Используйте Chrome, Edge или Firefox.";
}

function IconBell({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  );
}

/** layout="nav" — последний пункт в сайдбаре, как ссылка меню */
export function PushNotificationsToggle({ layout = "default" }: { layout?: "default" | "nav" }) {
  const [pushEnabled, setPushEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  /** null — ещё проверяем (важно для iOS PWA: там часто нет window.PushManager, но есть registration.pushManager) */
  const [supported, setSupported] = useState<boolean | null>(null);
  const [unsupportedHint, setUnsupportedHint] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof window === "undefined") return;
      if (!("serviceWorker" in navigator)) {
        if (!cancelled) {
          setSupported(false);
          setUnsupportedHint(getPushBrowserHint());
        }
        return;
      }
      try {
        await navigator.serviceWorker.ready;
        if (cancelled) return;
        setSupported(true);
      } catch {
        if (cancelled) return;
        setSupported(false);
        setUnsupportedHint(
          "Не удалось дождаться сервис-воркера. Нужен HTTPS; в приватном режиме Safari push отключён. Откройте сайт с иконки на главном экране, не из Safari.",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
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
    // iOS Safari / PWA: глобал `Notification` не всегда в scope как идентификатор — только через globalThis
    const NotificationCtor = globalThis.Notification;
    if (
      typeof NotificationCtor === "undefined" ||
      typeof NotificationCtor.requestPermission !== "function"
    ) {
      setStatus("error");
      setMessage(
        "API уведомлений недоступен. Откройте сайт по HTTPS, с иконки на главном экране (iOS 16.4+).",
      );
      return;
    }
    const perm = await NotificationCtor.requestPermission();
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

    const reg = await navigator.serviceWorker.ready;

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
      credentials: "same-origin",
      body: JSON.stringify({
        endpoint: subJson.endpoint,
        keys: { p256dh: subJson.keys.p256dh, auth: subJson.keys.auth },
      }),
    });

    if (!save.ok) {
      let detail = "Не удалось сохранить подписку";
      try {
        const j = (await save.json()) as { error?: string };
        if (typeof j.error === "string" && j.error.trim()) detail = j.error.trim();
      } catch {
        if (save.status === 401) detail = "Сессия истекла — войдите снова";
        else if (save.status === 403) detail = "Нет доступа (профиль или роль)";
      }
      setStatus("error");
      setMessage(detail);
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
    if (supported !== true || busy) return;
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

  const switchEl = (
    <button
      type="button"
      role="switch"
      aria-checked={pushEnabled}
      aria-label="Push-уведомления"
      disabled={busy || supported !== true}
      onClick={() => void onToggle()}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400",
        pushEnabled ? "bg-emerald-600" : "bg-zinc-300",
        (busy || supported !== true) && "opacity-60",
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow transition",
          pushEnabled ? "translate-x-5" : "translate-x-0.5",
        )}
      />
    </button>
  );

  const statusEl = (
    <>
      {status === "loading" && (
        <p className="text-xs text-zinc-500">Сохранение…</p>
      )}
      {status === "success" && (
        <p className="text-xs text-emerald-700">Готово</p>
      )}
      {status === "error" && message && (
        <p className="text-xs text-red-600">{message}</p>
      )}
    </>
  );

  if (supported === null) {
    if (layout === "nav") {
      return (
        <div className="flex min-h-11 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-zinc-400 md:min-h-0 md:py-2 md:text-xs">
          <IconBell className="h-[18px] w-[18px] shrink-0 animate-pulse text-zinc-300" />
          <span>Проверка уведомлений…</span>
        </div>
      );
    }
    return (
      <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-3 py-2.5 text-xs text-zinc-400">
        Проверка поддержки push…
      </div>
    );
  }

  if (!supported) {
    const hint = unsupportedHint ?? getPushBrowserHint();
    if (layout === "nav") {
      return (
        <div className="space-y-1 rounded-xl px-3 py-2.5 text-zinc-600 md:py-2">
          <div className="flex items-start gap-2.5">
            <IconBell className="mt-0.5 h-[18px] w-[18px] shrink-0 text-zinc-400" />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-medium text-zinc-800">Уведомления недоступны</p>
              <p className="text-xs leading-snug text-zinc-500">{hint}</p>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-1.5 rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-3 py-2.5 text-xs text-zinc-600">
        <p className="font-medium text-zinc-800">Push в этом браузере недоступны</p>
        <p className="leading-snug text-zinc-500">{hint}</p>
      </div>
    );
  }

  if (layout === "nav") {
    return (
      <div className="space-y-1.5 rounded-xl px-3 py-2.5 text-zinc-700 hover:bg-zinc-50 md:py-2">
        <div className="flex min-h-11 items-start gap-2.5 md:min-h-0 md:items-center">
          <IconBell className="mt-0.5 h-[18px] w-[18px] shrink-0 text-zinc-500 md:mt-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-zinc-900">Уведомления</p>
            <p className="text-xs text-zinc-500">Push, в т.ч. при закрытом сайте</p>
          </div>
          {switchEl}
        </div>
        <div className="pl-[calc(18px+0.625rem)]">{statusEl}</div>
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
        {switchEl}
      </div>
      {statusEl}
    </div>
  );
}
