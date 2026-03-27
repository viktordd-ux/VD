import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: "admin" | "executor";
      /** false для исполнителей до прохождения онбординга; у админов обычно не используется */
      onboarded?: boolean;
    };
  }

  interface User {
    role: "admin" | "executor";
    onboarded?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: "admin" | "executor";
    onboarded?: boolean;
  }
}
