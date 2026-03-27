import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const secret = process.env.AUTH_SECRET;

  let token: Awaited<ReturnType<typeof getToken>> = null;
  if (secret) {
    try {
      token = await getToken({
        req,
        secret,
        secureCookie: process.env.NODE_ENV === "production",
      });
    } catch {
      token = null;
    }
  }

  const isLoggedIn = !!token;
  const role = token?.role as "admin" | "executor" | undefined;
  const isApiAuth = pathname.startsWith("/api/auth");

  if (pathname.startsWith("/api") && !isApiAuth) {
    if (!isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (isApiAuth) {
    return NextResponse.next();
  }

  if (pathname === "/login") {
    if (isLoggedIn && role) {
      const home = role === "admin" ? "/admin" : "/executor";
      return NextResponse.redirect(new URL(home, req.nextUrl));
    }
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (pathname.startsWith("/admin") && role !== "admin") {
    return NextResponse.redirect(new URL("/executor", req.nextUrl));
  }

  if (pathname.startsWith("/executor") && role !== "executor") {
    return NextResponse.redirect(new URL("/admin", req.nextUrl));
  }

  if (pathname === "/") {
    const home = role === "admin" ? "/admin" : "/executor";
    return NextResponse.redirect(new URL(home, req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
