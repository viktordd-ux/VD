"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ConvertLeadButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onConvert() {
    setLoading(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/convert`, { method: "POST" });
      if (!res.ok) throw new Error();
      router.push("/admin/orders");
      router.refresh();
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
      className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
    >
      {loading ? "…" : "В заказ"}
    </button>
  );
}
