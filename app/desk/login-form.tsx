"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { DESK_LOGIN_API } from "@/lib/desk-path";

export function DeskLoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(DESK_LOGIN_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Wrong password");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-4">
      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
      >
        <h1 className="text-lg font-semibold tracking-tight text-zinc-900">
          Rate collection
        </h1>
        <label className="flex flex-col gap-1 text-sm text-zinc-600">
          Password
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="min-h-11 rounded-md border border-zinc-300 px-3 py-2 text-base text-zinc-900 sm:min-h-0 sm:text-sm"
            required
          />
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="min-h-11 rounded-md bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
