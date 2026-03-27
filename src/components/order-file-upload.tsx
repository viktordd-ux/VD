"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAppToast } from "@/components/toast-provider";

export function OrderFileUpload({ orderId }: { orderId: string }) {
  const router = useRouter();
  const toast = useAppToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  async function onUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = fd.get("file") as File | null;
    if (!file || file.size === 0) return;
    if (file.size > 50 * 1024 * 1024) {
      toast("Файл слишком большой. Максимум 50 МБ.", "error");
      return;
    }

    setUploading(true);
    const res = await fetch(`/api/orders/${orderId}/files`, {
      method: "POST",
      body: fd,
    });
    setUploading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast(body?.error ?? "Ошибка загрузки файла", "error");
      return;
    }

    formRef.current?.reset();
    setFileName(null);
    toast("Файл загружен", "success");
    router.refresh();
  }

  return (
    <form ref={formRef} onSubmit={onUpload} className="mt-4 space-y-3">
      <div>
        <label className="text-xs font-medium text-zinc-600">Загрузить документ (ТЗ, бриф, референсы…)</label>
        <div className="mt-1 flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 text-zinc-500"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            {fileName ?? "Выбрать файл"}
            <input
              type="file"
              name="file"
              required
              className="sr-only"
              accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp,.zip,.xlsx,.xls"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            />
          </label>
          {fileName && (
            <span className="max-w-xs truncate text-xs text-zinc-500">{fileName}</span>
          )}
        </div>
      </div>
      <div>
        <input
          name="comment"
          placeholder="Комментарий (необязательно)"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <Button type="submit" variant="primary" size="md" disabled={uploading || !fileName}>
        {uploading ? "Загружаю…" : "Загрузить"}
      </Button>
    </form>
  );
}
