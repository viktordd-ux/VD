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
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]">
      <div
        className="w-full max-w-md rounded-xl border border-[color:var(--border)] bg-[var(--card)] p-6 shadow-xl shadow-black/10 dark:shadow-black/50"
        role="dialog"
        aria-labelledby="cred-title"
      >
        <h2 id="cred-title" className="text-lg font-semibold text-[var(--text)]">
          {title}
        </h2>
        <p className="mt-4 text-sm text-[var(--muted)]">
          Сохраните данные — пароль больше не будет показан.
        </p>
        <dl className="mt-4 space-y-2 rounded-lg border border-[color:var(--border)] bg-[var(--bg)] p-4 font-mono text-sm">
          <div>
            <dt className="text-xs uppercase text-[var(--muted)]">Логин</dt>
            <dd className="break-all text-[var(--text)]">{email}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-[var(--muted)]">Пароль</dt>
            <dd className="break-all text-[var(--text)]">{password}</dd>
          </div>
        </dl>
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copy}
            className="rounded-md bg-[var(--text)] px-4 py-2 text-sm font-medium text-[var(--bg)] transition hover:opacity-90"
          >
            Скопировать
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[color:var(--border)] px-4 py-2 text-sm text-[var(--text)] transition hover:bg-[color:var(--muted-bg)]"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
