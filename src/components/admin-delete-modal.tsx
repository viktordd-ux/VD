"use client";

import { useEffect, useState } from "react";

/** Только безвозвратное удаление с вводом DELETE. */
export function AdminHardDeleteOnlyModal({
  open,
  onClose,
  title,
  hint,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  hint: string;
  onConfirm: () => Promise<void>;
}) {
  const [typed, setTyped] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setTyped("");
      setLoading(false);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-red-200 bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-red-900">{title}</h3>
        <p className="mt-2 text-sm text-red-800">{hint}</p>
        <p className="mt-2 text-xs text-zinc-500">
          Введите <span className="font-mono font-semibold">DELETE</span> для подтверждения.
        </p>
        <input
          className="mt-3 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="DELETE"
          autoComplete="off"
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={typed !== "DELETE" || loading}
            onClick={async () => {
              setLoading(true);
              try {
                await onConfirm();
                onClose();
              } catch (e) {
                const msg =
                  e instanceof Error && e.message.trim()
                    ? e.message
                    : "Не удалось выполнить операцию";
                alert(msg);
              } finally {
                setLoading(false);
              }
            }}
            className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
          >
            {loading ? "…" : "Удалить безвозвратно"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-700"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  softHint: string;
  hardHint: string;
  onSoft: () => Promise<void>;
  onHard: () => Promise<void>;
};

/** Подтверждение: сначала скрытие, отдельный шаг для hard с вводом DELETE. */
export function AdminDeleteModal({
  open,
  onClose,
  title,
  softHint,
  hardHint,
  onSoft,
  onHard,
}: Props) {
  const [step, setStep] = useState<"main" | "hard">("main");
  const [typed, setTyped] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep("main");
      setTyped("");
      setLoading(false);
    }
  }, [open]);

  if (!open) return null;

  async function run(fn: () => Promise<void>) {
    setLoading(true);
    try {
      await fn();
      onClose();
    } catch {
      alert("Не удалось выполнить операцию");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
      >
        <h3 className="text-lg font-semibold text-zinc-900">{title}</h3>

        {step === "main" ? (
          <>
            <p className="mt-3 text-sm text-zinc-600">{softHint}</p>
            <p className="mt-2 text-xs text-zinc-500">
              Вы уверены? Скрытые данные остаются в базе и не попадают в отчёты.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => void run(onSoft)}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {loading ? "…" : "Удалить (скрыть)"}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => setStep("hard")}
                className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-900 hover:bg-red-100"
              >
                Удалить навсегда…
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                Отмена
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-3 text-sm text-red-800">{hardHint}</p>
            <p className="mt-2 text-xs text-zinc-500">
              Введите <span className="font-mono font-semibold">DELETE</span> для подтверждения.
            </p>
            <input
              className="mt-3 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={typed !== "DELETE" || loading}
                onClick={() => void run(onHard)}
                className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
              >
                {loading ? "…" : "Удалить безвозвратно"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("main");
                  setTyped("");
                }}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-700"
              >
                Назад
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
