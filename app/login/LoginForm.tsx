"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/sales/by-managers";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const json = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(json?.error ?? "Не удалось войти");
        return;
      }

      router.replace(nextPath);
      router.refresh();
    } catch {
      setError("Сервер недоступен");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary px-4">
      <div className="w-full max-w-sm rounded-xl border border-border-primary bg-bg-card p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-text-primary">Смекалочная</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Введите логин и пароль для доступа к отчётам.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-1">
            <span className="text-sm text-text-secondary">Логин</span>
            <input
              autoComplete="username"
              className="w-full rounded-md border border-border-primary bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none ring-accent-primary focus:ring-2"
              name="username"
              onChange={(event) => setUsername(event.target.value)}
              required
              type="text"
              value={username}
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm text-text-secondary">Пароль</span>
            <input
              autoComplete="current-password"
              className="w-full rounded-md border border-border-primary bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none ring-accent-primary focus:ring-2"
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>

          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          <button
            className="w-full rounded-md bg-accent-primary px-3 py-2 text-sm font-medium text-text-on-accent disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Вход…" : "Войти"}
          </button>
        </form>
      </div>
    </div>
  );
}
