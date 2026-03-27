"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAppToast } from "@/components/toast-provider";

export function OrderFileUpload({ orderId }: { orderId: string }) {
  const router = useRouter();
  const toast = useAppToast();
  const formRef = useRef<HTMLFormElement>(null);
  const linkFormRef = useRef<HTMLFormElement>(null);
  const [uploading, setUploading] = useState(false);
  const [linkSaving, setLinkSaving] = useState(false);
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

  async function onAddLink(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const externalUrl = String(fd.get("externalUrl") ?? "").trim();
    const linkTitle = String(fd.get("linkTitle") ?? "").trim();
    const comment = String(fd.get("comment") ?? "").trim();

    if (!externalUrl) {
      toast("Укажите ссылку", "error");
      return;
    }

    setLinkSaving(true);
    const res = await fetch(`/api/orders/${orderId}/files`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        externalUrl,
        linkTitle: linkTitle || undefined,
        comment: comment || undefined,
      }),
    });
    setLinkSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast(body?.error ?? "Не удалось сохранить ссылку", "error");
      return;
    }

    linkFormRef.current?.reset();
    toast("Ссылка добавлена", "success");
    router.refresh();
  }

  return (
    <div className="mt-4 space-y-6">
      <form
        ref={formRef}
        onSubmit={onUpload}
        className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4"
      >
        <div>
          <label className="text-xs font-medium text-zinc-600">
            Загрузить документ (ТЗ, бриф, референсы…)
          </label>
          <div className="mt-1 flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100">
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

      <form
        ref={linkFormRef}
        onSubmit={onAddLink}
        className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"
      >
        <p className="text-xs font-medium text-zinc-600">Или добавить ссылку</p>
        <div>
          <label className="sr-only" htmlFor={`link-url-${orderId}`}>
            URL
          </label>
          <input
            id={`link-url-${orderId}`}
            name="externalUrl"
            type="url"
            inputMode="url"
            placeholder="https://…"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            autoComplete="off"
          />
        </div>
        <div>
          <input
            name="linkTitle"
            placeholder="Название (необязательно)"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <input
            name="comment"
            placeholder="Комментарий (необязательно)"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <Button type="submit" variant="secondary" size="md" disabled={linkSaving}>
          {linkSaving ? "Сохраняю…" : "Добавить ссылку"}
        </Button>
      </form>
    </div>
  );
}
