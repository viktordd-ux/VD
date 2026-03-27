import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const { default: prisma } = await import("@/lib/prisma");
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || user.status !== "active") return null;

        const ok = await compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const role = auth?.user?.role as "admin" | "executor" | undefined;
      const pathname = nextUrl.pathname;
      const isApiAuth = pathname.startsWith("/api/auth");

      if (pathname.startsWith("/api") && !isApiAuth) {
        return isLoggedIn;
      }
      if (isApiAuth) return true;
      if (pathname === "/login") return true;
      if (!isLoggedIn) return false;
      if (pathname.startsWith("/admin") && role !== "admin") {
        return Response.redirect(new URL("/executor", nextUrl));
      }
      if (pathname.startsWith("/executor") && role !== "executor") {
        return Response.redirect(new URL("/admin", nextUrl));
      }
      if (pathname === "/") {
        return Response.redirect(new URL(role === "admin" ? "/admin" : "/executor", nextUrl));
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "admin" | "executor";
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
});
