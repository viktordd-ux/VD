import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const role = (req.auth?.user as { role?: "admin" | "executor" } | undefined)?.role;
  const onboarded = (req.auth?.user as { onboarded?: boolean } | undefined)?.onboarded;
  const isApiAuth = pathname.startsWith("/api/auth");

  if (pathname.startsWith("/api") && !isApiAuth) {
    if (!isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (
      role === "executor" &&
      onboarded === false &&
      !pathname.startsWith("/api/users/me")
    ) {
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
      return NextResponse.redirect(
        new URL(role === "admin" ? "/admin" : "/executor", req.nextUrl),
      );
    }
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (role === "executor" && onboarded === false) {
    if (pathname.startsWith("/executor/onboarding")) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/executor/onboarding", req.nextUrl));
  }

  if (role === "executor" && onboarded !== false && pathname.startsWith("/executor/onboarding")) {
    return NextResponse.redirect(new URL("/executor", req.nextUrl));
  }

  if (pathname.startsWith("/admin") && role !== "admin") {
    return NextResponse.redirect(new URL("/executor", req.nextUrl));
  }

  if (pathname.startsWith("/executor") && role !== "executor") {
    return NextResponse.redirect(new URL("/admin", req.nextUrl));
  }

  if (pathname === "/") {
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
