"use client";

export function CredentialsModal({
  open,
  title,
  email,
  password,
  onClose,
}: {
  open: boolean;
  title: string;
  email: string;
  password: string;
  onClose: () => void;
}) {
  if (!open) return null;

  function copy() {
    const text = `Логин: ${email}\nПароль: ${password}`;
    void navigator.clipboard.writeText(text);
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4">
      <div
        className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl"
        role="dialog"
        aria-labelledby="cred-title"
      >
        <h2 id="cred-title" className="text-lg font-semibold text-zinc-900">
          {title}
        </h2>
        <p className="mt-4 text-sm text-zinc-600">
          Сохраните данные — пароль больше не будет показан.
        </p>
        <dl className="mt-4 space-y-2 rounded-lg bg-zinc-50 p-4 font-mono text-sm">
          <div>
            <dt className="text-xs uppercase text-zinc-500">Логин</dt>
            <dd className="break-all text-zinc-900">{email}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-zinc-500">Пароль</dt>
            <dd className="break-all text-zinc-900">{password}</dd>
          </div>
        </dl>
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copy}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Скопировать
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
