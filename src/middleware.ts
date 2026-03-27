import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const isApiAuth = pathname.startsWith("/api/auth");

  if (pathname.startsWith("/api") && !isApiAuth) {
    if (!isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return;
  }

  /** NextAuth: /api/auth/session, signin, csrf и т.д. должны отдавать JSON, не редирект на /login */
  if (isApiAuth) {
    return NextResponse.next();
  }

  if (pathname === "/login") {
    if (isLoggedIn && req.auth?.user) {
      const home =
        req.auth.user.role === "admin" ? "/admin" : "/executor";
      return NextResponse.redirect(new URL(home, req.nextUrl));
    }
    return;
  }

  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (pathname.startsWith("/admin") && req.auth?.user?.role !== "admin") {
    return NextResponse.redirect(new URL("/executor", req.nextUrl));
  }

  if (pathname.startsWith("/executor") && req.auth?.user?.role !== "executor") {
    return NextResponse.redirect(new URL("/admin", req.nextUrl));
  }

  if (pathname === "/") {
    const home = req.auth?.user?.role === "admin" ? "/admin" : "/executor";
    return NextResponse.redirect(new URL(home, req.nextUrl));
  }
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
