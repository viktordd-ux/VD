"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <Button
      type="button"
      variant="secondary"
      size="md"
      className="w-full"
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      Выйти
    </Button>
  );
}
