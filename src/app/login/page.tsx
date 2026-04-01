"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Неверный email или пароль");
      return;
    }
    router.push("/");
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-zinc-100 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200/90 bg-white p-8 shadow-sm shadow-zinc-950/[0.04]">
        <h1 className="text-center text-xl font-semibold tracking-tight">
          V<span className="text-zinc-400">|</span>D
        </h1>
        <p className="mt-1 text-center text-sm text-zinc-500">Вход в студию</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700">Эл. почта</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full min-h-11 rounded-md border border-zinc-300 px-3 py-2.5 text-base outline-none focus:border-zinc-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700">Пароль</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full min-h-11 rounded-md border border-zinc-300 px-3 py-2.5 text-base outline-none focus:border-zinc-900"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="min-h-11 w-full rounded-md bg-zinc-900 py-2.5 text-base font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            {loading ? "…" : "Войти"}
          </button>
        </form>
      </div>
    </div>
  );
}
