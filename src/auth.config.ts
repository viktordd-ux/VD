import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  providers: [],
  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.onboarded = user.onboarded;
      }
      if (trigger === "update" && session) {
        const s = session as { onboarded?: boolean };
        if (typeof s.onboarded === "boolean") {
          token.onboarded = s.onboarded;
        }
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "admin" | "executor";
        session.user.onboarded =
          typeof token.onboarded === "boolean" ? token.onboarded : undefined;
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
} satisfies NextAuthConfig;
