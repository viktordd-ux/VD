"use client";

import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { GlobalSearchCommand } from "@/components/global-search-command";
import { QuickCreateOrderModal } from "@/components/quick-create-order-modal";
import { NotificationCenter } from "@/components/notification-center";
import { ThemeToggle } from "@/components/theme-toggle";
import { QuickCreateContext } from "@/context/quick-create-context";
import { useInvalidateAdminOrders } from "@/hooks/use-invalidate-admin-orders";
import { isEditableKeyboardTarget } from "@/lib/keyboard-utils";
import { queryKeys } from "@/lib/query-keys";

function readOrderNavIds(): string[] {
  try {
    const raw = sessionStorage.getItem("vd:admin-order-ids");
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function AdminWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const invalidateOrders = useInvalidateAdminOrders();

  const [searchOpen, setSearchOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);

  const openSearch = useCallback(() => setSearchOpen(true), []);
  const openQuick = useCallback(() => setQuickOpen(true), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const inEditable = isEditableKeyboardTarget(target);

      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
        return;
      }

      if (mod && e.key === "Enter") {
        const form = document.getElementById("admin-order-edit-form");
        if (form instanceof HTMLFormElement) {
          e.preventDefault();
          form.requestSubmit();
        }
        return;
      }

      if (e.key === "Escape") {
        setSearchOpen(false);
        setQuickOpen(false);
        window.dispatchEvent(new CustomEvent("vd:close-overlays"));
        return;
      }

      if (searchOpen || quickOpen) {
        if (!mod && (e.key === "f" || e.key === "F" || e.key === "c" || e.key === "C")) {
          return;
        }
      }

      if (inEditable && !mod) {
        if (e.key === "f" || e.key === "F" || e.key === "c" || e.key === "C") return;
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") return;
        return;
      }

      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        openSearch();
        return;
      }
      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        openQuick();
        return;
      }

      const orderMatch = /^\/admin\/orders\/([^/]+)$/.exec(pathname);
      if (orderMatch && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        const currentId = orderMatch[1];
        const ids = readOrderNavIds();
        const i = ids.indexOf(currentId);
        if (i < 0) return;
        if (e.key === "ArrowLeft" && i > 0) {
          router.push(`/admin/orders/${ids[i - 1]}`);
        }
        if (e.key === "ArrowRight" && i < ids.length - 1) {
          router.push(`/admin/orders/${ids[i + 1]}`);
        }
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openSearch, openQuick, pathname, router, searchOpen, quickOpen]);

  const onQuickCreated = useCallback(() => {
    invalidateOrders();
    void queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
  }, [invalidateOrders, queryClient]);

  return (
    <QuickCreateContext.Provider value={{ open: openQuick }}>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="pointer-events-none fixed right-3 top-[calc(3.25rem+env(safe-area-inset-top,0px))] z-40 flex items-center gap-2 md:right-6 md:top-4 md:pt-0">
          <div className="pointer-events-auto flex items-center gap-2">
            <ThemeToggle />
            <NotificationCenter />
          </div>
        </div>
        {children}
      </div>
      <GlobalSearchCommand open={searchOpen} onClose={() => setSearchOpen(false)} />
      <QuickCreateOrderModal
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
        onCreated={onQuickCreated}
      />
    </QuickCreateContext.Provider>
  );
}
