import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  providers: [],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.onboarded = user.onboarded === true;
      }
      if (trigger === "update" && session) {
        const s = session as { onboarded?: boolean };
        if (typeof s.onboarded === "boolean") {
          token.onboarded = s.onboarded;
        }
      }
      // Старые JWT без onboarded: один запрос к БД на сессию, не на каждый вызов jwt (иначе каждая навигация + middleware ждут Prisma).
      if (
        token.role === "executor" &&
        token.id &&
        !user &&
        typeof token.onboarded !== "boolean" &&
        !token.executorOnboardedChecked
      ) {
        token.executorOnboardedChecked = true;
        try {
          const { default: prisma } = await import("@/lib/prisma");
          const u = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { onboarded: true },
          });
          token.onboarded = u?.onboarded === true;
        } catch {
          token.onboarded = false;
        }
      }
      if (token.role === "executor" && typeof token.onboarded !== "boolean") {
        token.onboarded = false;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "admin" | "executor";
        const tb = token.onboarded;
        if (token.role === "executor") {
          session.user.onboarded = typeof tb === "boolean" ? tb : false;
        } else {
          session.user.onboarded = typeof tb === "boolean" ? tb : undefined;
        }
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
} satisfies NextAuthConfig;
