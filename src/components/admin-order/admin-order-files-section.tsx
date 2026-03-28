"use client";

import type { File as FileModel } from "@prisma/client";
import { OrderFileUpload } from "@/components/order-file-upload";
import { displayFileEntryLabel } from "@/lib/uploads";
import { parseFileFromApiJson } from "@/lib/order-client-deserialize";
import { useAdminOrder } from "./admin-order-context";

export function AdminOrderFilesSection({ orderId }: { orderId: string }) {
  const { files, setFiles, bumpHistory } = useAdminOrder();

  function onUploaded(fileJson: Record<string, unknown>) {
    const f = parseFileFromApiJson(fileJson);
    setFiles((prev) => [f, ...prev]);
    bumpHistory();
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Файлы</h2>
          <p className="mt-0.5 text-xs text-zinc-500">ТЗ, брифы, референсы и результаты работы</p>
        </div>
        {files.length > 0 && (
          <a
            href={`/api/orders/${orderId}/files/archive`}
            className="text-sm font-medium text-zinc-800 underline-offset-2 hover:underline"
          >
            Скачать архив (ZIP)
          </a>
        )}
      </div>

      <OrderFileUpload orderId={orderId} onUploaded={onUploaded} />

      {files.length > 0 && (
        <ul className="mt-5 space-y-2">
          {files.map((f: FileModel) => (
            <li
              key={f.id}
              className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm shadow-sm"
            >
              <span
                className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  f.uploadedBy === "admin"
                    ? "bg-zinc-200 text-zinc-800"
                    : "bg-zinc-100 text-zinc-600"
                }`}
              >
                {f.uploadedBy === "admin" ? "Админ" : "Исполнитель"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={`/api/files/${f.id}`}
                    className="min-w-0 truncate font-medium text-zinc-900 underline-offset-2 hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {displayFileEntryLabel(f)}
                  </a>
                  {f.kind === "link" && (
                    <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-zinc-600">
                      Ссылка
                    </span>
                  )}
                </div>
                {f.comment && (
                  <p className="mt-0.5 text-xs text-zinc-500">{f.comment}</p>
                )}
                <p className="mt-0.5 text-xs text-zinc-400">
                  {new Date(f.createdAt).toLocaleString("ru-RU", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {files.length === 0 && (
        <p className="mt-4 text-sm text-zinc-400">Файлов пока нет.</p>
      )}
    </>
  );
}
