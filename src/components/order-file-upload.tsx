"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAppToast } from "@/components/toast-provider";
import { postFormDataWithProgress } from "@/lib/upload-form-xhr";

const inputClass =
  "w-full rounded-md border border-[color:var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--text)] shadow-sm placeholder:text-[var(--muted)]";

export function OrderFileUpload({
  orderId,
  onUploaded,
}: {
  orderId: string;
  /** Если задан — после успеха вызывается вместо router.refresh (локальный state). */
  onUploaded?: (fileJson: Record<string, unknown>) => void;
}) {
  const router = useRouter();
  const toast = useAppToast();
  const formRef = useRef<HTMLFormElement>(null);
  const linkFormRef = useRef<HTMLFormElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
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
    setUploadProgress(0);
    try {
      const { ok, body } = await postFormDataWithProgress(
        `/api/orders/${orderId}/files`,
        fd,
        (pct) => setUploadProgress(pct),
      );
      if (!ok) {
        const err = body as { error?: string };
        toast(err?.error ?? "Ошибка загрузки файла", "error");
        return;
      }
      const fileJson = body as Record<string, unknown>;
      formRef.current?.reset();
      setFileName(null);
      toast("Файл загружен", "success");
      if (onUploaded) onUploaded(fileJson);
      else router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Ошибка загрузки файла", "error");
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
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
    const controller = new AbortController();
    const abortTimer = window.setTimeout(() => controller.abort(), 60_000);
    let res: Response;
    try {
      res = await fetch(`/api/orders/${orderId}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          externalUrl,
          linkTitle: linkTitle || undefined,
          comment: comment || undefined,
        }),
        cache: "no-store",
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(abortTimer);
      setLinkSaving(false);
      toast(
        err instanceof Error && err.name === "AbortError"
          ? "Сохранение слишком долгое (таймаут 1 мин)"
          : "Не удалось сохранить ссылку",
        "error",
      );
      return;
    }
    clearTimeout(abortTimer);
    setLinkSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast(body?.error ?? "Не удалось сохранить ссылку", "error");
      return;
    }

    const fileJson = (await res.json()) as Record<string, unknown>;
    linkFormRef.current?.reset();
    toast("Ссылка добавлена", "success");
    if (onUploaded) onUploaded(fileJson);
    else router.refresh();
  }

  return (
    <div className="mt-4 space-y-6">
      <form
        ref={formRef}
        onSubmit={onUpload}
        className="space-y-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--muted-bg)] p-4 shadow-sm dark:shadow-black/20"
      >
        <div>
          <label className="text-xs font-medium text-[var(--muted)]">
            Загрузить документ (ТЗ, бриф, референсы…)
          </label>
          <div className="mt-1 flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-[color:var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--text)] shadow-sm transition-colors hover:bg-[color:var(--muted-bg)]">
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
                className="shrink-0 text-[var(--muted)]"
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
              <span className="max-w-xs truncate text-xs text-[var(--muted)]">{fileName}</span>
            )}
          </div>
        </div>
        <div>
          <input
            name="comment"
            placeholder="Комментарий (необязательно)"
            className={inputClass}
          />
        </div>
        {uploadProgress !== null && (
          <div className="space-y-1">
            <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--muted-bg)] ring-1 ring-[color:var(--border)]">
              <div
                className="h-full rounded-full bg-zinc-900 transition-[width] duration-150 dark:bg-white"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-xs tabular-nums text-[var(--muted)]">{uploadProgress}%</p>
          </div>
        )}
        <Button
          type="submit"
          variant="primary"
          size="md"
          loading={uploading}
          disabled={uploading || !fileName}
        >
          Загрузить
        </Button>
      </form>

      <form
        ref={linkFormRef}
        onSubmit={onAddLink}
        className="space-y-3 rounded-xl border border-[color:var(--border)] bg-[var(--card)] p-4 shadow-sm dark:shadow-black/30"
      >
        <p className="text-xs font-medium text-[var(--muted)]">Или добавить ссылку</p>
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
            className={inputClass}
            autoComplete="off"
          />
        </div>
        <div>
          <input
            name="linkTitle"
            placeholder="Название (необязательно)"
            className={inputClass}
          />
        </div>
        <div>
          <input
            name="comment"
            placeholder="Комментарий (необязательно)"
            className={inputClass}
          />
        </div>
        <Button
          type="submit"
          variant="primary"
          size="md"
          loading={linkSaving}
          disabled={linkSaving}
        >
          Добавить ссылку
        </Button>
      </form>
    </div>
  );
}
