import { auth } from "@/auth";
import { NextResponse } from "next/server";

/** Only explicit `true` counts as completed onboarding (undefined/false → must complete). */
function executorOnboardingDone(onboarded: boolean | undefined) {
  return onboarded === true;
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (pathname === "/api/health") {
    return NextResponse.next();
  }

  if (
    pathname === "/sw.js" ||
    pathname === "/manifest.json" ||
    pathname === "/icon-192.png" ||
    pathname === "/icon-512.png"
  ) {
    return NextResponse.next();
  }

  const isLoggedIn = !!req.auth;
  const role = (req.auth?.user as { role?: "admin" | "executor" } | undefined)?.role;
  const onboarded = (req.auth?.user as { onboarded?: boolean } | undefined)?.onboarded;
  const executorReady = role === "executor" && executorOnboardingDone(onboarded);
  const executorNeedsOnboarding = role === "executor" && !executorOnboardingDone(onboarded);
  const isApiAuth = pathname.startsWith("/api/auth");

  if (pathname.startsWith("/api") && !isApiAuth) {
    /** Публичный VAPID-ключ (не секрет); без сессии тоже доступен для fetch. */
    if (pathname === "/api/push/vapid-public-key") {
      return NextResponse.next();
    }
    if (!isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    /** Исполнитель до онбординга: чтение уведомлений и счётчиков как у остального UI. */
    const apiAllowedBeforeExecutorOnboarding =
      pathname.startsWith("/api/users/me") ||
      pathname.startsWith("/api/push/") ||
      pathname === "/api/notifications" ||
      pathname === "/api/orders/unread";
    if (executorNeedsOnboarding && !apiAllowedBeforeExecutorOnboarding) {
      return NextResponse.json(
        { error: "Требуется завершить регистрацию профиля" },
        { status: 403 },
      );
    }
    return NextResponse.next();
  }

  if (isApiAuth) return NextResponse.next();

  if (pathname === "/login") {
    if (isLoggedIn && role) {
      if (executorNeedsOnboarding) {
        return NextResponse.redirect(new URL("/executor/onboarding", req.nextUrl));
      }
      return NextResponse.redirect(
        new URL(role === "admin" ? "/admin" : "/executor", req.nextUrl),
      );
    }
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (executorNeedsOnboarding) {
    if (pathname.startsWith("/executor/onboarding")) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/executor/onboarding", req.nextUrl));
  }

  if (executorReady && pathname.startsWith("/executor/onboarding")) {
    return NextResponse.redirect(new URL("/executor", req.nextUrl));
  }

  if (pathname.startsWith("/admin") && role !== "admin") {
    return NextResponse.redirect(new URL("/executor", req.nextUrl));
  }

  if (pathname.startsWith("/executor") && role !== "executor") {
    return NextResponse.redirect(new URL("/admin", req.nextUrl));
  }

  if (pathname === "/") {
    if (executorNeedsOnboarding) {
      return NextResponse.redirect(new URL("/executor/onboarding", req.nextUrl));
    }
    return NextResponse.redirect(
      new URL(role === "admin" ? "/admin" : "/executor", req.nextUrl),
    );
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
