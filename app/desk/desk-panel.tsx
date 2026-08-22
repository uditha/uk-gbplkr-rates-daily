"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";
import { GLOBAL_EXCHANGE_PROVIDER_ID } from "@/lib/providers/global-exchange-meta";
import type { ProviderRecord, RatesStoreState } from "@/lib/store/types";
import { ProviderLogo } from "@/components/ProviderLogo";
import { useRatesStore } from "@/components/RatesProvider";
import { DESK_LOGOUT_API, DESK_RATES_API } from "@/lib/desk-path";

function statusLabel(record: ProviderRecord) {
  if (record.status === "ok") return "Ready";
  if (record.status === "error") return "Error";
  if (record.status === "not_wired") return "Not wired";
  return "Not fetched";
}

function formatWhen(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function DeskPanel() {
  const router = useRouter();
  const { state, replaceState } = useRatesStore();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [manualRates, setManualRates] = useState<Record<string, string>>({});

  async function postRates(body: { providerId: string; sendRate?: number }) {
    setBusyId(body.providerId);
    setMessage(null);
    try {
      const response = await fetch(DESK_RATES_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(body),
      });
      if (response.status === 401) {
        router.refresh();
        return;
      }
      const payload = (await response.json()) as {
        state?: RatesStoreState;
        error?: string;
      };
      if (payload.state) {
        replaceState(payload.state);
        router.refresh();
      }
      if (!response.ok) {
        throw new Error(payload.error ?? "Refresh failed");
      }
      setMessage(
        body.sendRate != null
          ? `Saved Global Exchange rate ${body.sendRate}.`
          : body.providerId === "all"
            ? "Refreshed all wired providers."
            : "Provider refreshed from its source site.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Refresh failed");
    } finally {
      setBusyId(null);
    }
  }

  async function signOut() {
    await fetch(DESK_LOGOUT_API, { method: "POST" });
    router.refresh();
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">
          Rate collection
        </h1>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Link
            href="/"
            prefetch={false}
            className="min-h-11 rounded-md border border-zinc-200 px-3 py-2 text-center text-sm text-zinc-700 hover:bg-zinc-50 sm:min-h-0"
          >
            View heatmap
          </Link>
          <button
            type="button"
            onClick={() => postRates({ providerId: "all" })}
            disabled={busyId != null}
            className="min-h-11 rounded-md bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-800 disabled:opacity-50 sm:min-h-0"
          >
            {busyId === "all" ? "Refreshing…" : "Refresh wired"}
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="col-span-2 min-h-11 rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 sm:col-span-1 sm:min-h-0"
          >
            Sign out
          </button>
        </div>
      </header>

      {message ? (
        <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
          {message}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-zinc-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs font-medium tracking-wide text-zinc-500 uppercase">
            <tr>
              <th className="px-4 py-3">Provider</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Rate</th>
              <th className="px-4 py-3">As of</th>
              <th className="px-4 py-3">Last run</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {state.providers.map((record) => (
              <Fragment key={record.id}>
                <tr className="border-t border-zinc-200">
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <ProviderLogo id={record.id} name={record.name} size={36} />
                      <div className="min-w-0">
                        <div className="font-medium text-zinc-900">{record.name}</div>
                        {record.error ? (
                          <div className="mt-1 text-xs text-red-600">{record.error}</div>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-700">{statusLabel(record)}</td>
                  <td className="px-4 py-3 font-mono tabular-nums text-zinc-800">
                    {record.snapshot
                      ? record.snapshot.boardRate.toFixed(2)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {record.snapshot?.asOf ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {formatWhen(record.updatedAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => postRates({ providerId: record.id })}
                      disabled={!record.wired || busyId != null}
                      className="min-h-11 rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-0"
                    >
                      {busyId === record.id ? "Refreshing…" : "Refresh"}
                    </button>
                  </td>
                </tr>
                {record.id === GLOBAL_EXCHANGE_PROVIDER_ID ? (
                  <tr className="bg-zinc-50">
                    <td colSpan={6} className="px-4 py-3">
                      <form
                        className="flex flex-wrap items-end gap-2"
                        onSubmit={(event) => {
                          event.preventDefault();
                          const value = Number(
                            manualRates[record.id] ||
                              record.snapshot?.boardRate ||
                              "",
                          );
                          void postRates({
                            providerId: record.id,
                            sendRate: value,
                          });
                        }}
                      >
                        <label className="flex flex-col gap-1 text-xs text-zinc-600">
                          LKR per £1
                          <input
                            type="number"
                            step="0.01"
                            min="1"
                            className="rounded-md border border-zinc-300 px-2 py-1.5 font-mono text-sm text-zinc-900"
                            value={
                              manualRates[record.id] ??
                              (record.snapshot
                                ? String(record.snapshot.boardRate)
                                : "")
                            }
                            onChange={(event) =>
                              setManualRates((current) => ({
                                ...current,
                                [record.id]: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <button
                          type="submit"
                          disabled={busyId != null}
                          className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                        >
                          Save rate
                        </button>
                      </form>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
