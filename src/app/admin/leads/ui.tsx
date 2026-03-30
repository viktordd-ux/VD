"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdminDeleteModal } from "@/components/admin-delete-modal";
import { useLeadsListMutations } from "@/context/leads-list-mutations";

export function ConvertLeadButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const list = useLeadsListMutations();
  const [loading, setLoading] = useState(false);

  async function onConvert() {
    setLoading(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/convert`, { method: "POST" });
      if (!res.ok) throw new Error();
      list?.removeLead(leadId);
      router.push("/admin/orders");
    } catch {
      setLoading(false);
      alert("Не удалось конвертировать");
      return;
    }
    setLoading(false);
  }

  return (
    <button
      type="button"
      disabled={loading}
      title="Создать заказ из лида одним кликом"
      onClick={onConvert}
      className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 sm:w-auto sm:min-h-0 sm:py-1.5 sm:text-xs"
    >
      {loading ? "…" : "В заказ"}
    </button>
  );
}

export function LeadDeleteButton({ leadId }: { leadId: string }) {
  const list = useLeadsListMutations();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-50 sm:w-auto sm:min-h-0 sm:px-2 sm:py-1.5 sm:text-xs"
      >
        Удалить
      </button>
      <AdminDeleteModal
        open={open}
        onClose={() => setOpen(false)}
        title="Удалить лид"
        softHint="Лид скроется из списка; запись останется в базе."
        hardHint="Лид будет удалён из базы; связь с заказами будет снята."
        onSoft={async () => {
          const res = await fetch(`/api/leads/${leadId}`, { method: "DELETE" });
          if (!res.ok) {
            const j = (await res.json().catch(() => ({}))) as { error?: string };
            alert(j.error ?? "Ошибка");
            throw new Error("abort");
          }
          list?.removeLead(leadId);
        }}
        onHard={async () => {
          const res = await fetch(`/api/leads/${leadId}?hard=true`, {
            method: "DELETE",
          });
          if (!res.ok) throw new Error();
          list?.removeLead(leadId);
        }}
      />
    </>
  );
}
