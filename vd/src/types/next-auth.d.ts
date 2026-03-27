import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: "admin" | "executor";
    };
  }

  interface User {
    role: "admin" | "executor";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: "admin" | "executor";
  }
}
