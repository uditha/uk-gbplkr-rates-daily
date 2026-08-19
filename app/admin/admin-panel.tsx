"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { GLOBAL_EXCHANGE_PROVIDER_ID } from "@/lib/providers/global-exchange";
import type { ProviderRecord, RatesStoreState } from "@/lib/store/types";

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

export function AdminPanel({ initialState }: { initialState: RatesStoreState }) {
  const [state, setState] = useState(initialState);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [manualRates, setManualRates] = useState<Record<string, string>>({});

  async function postRates(body: { providerId: string; sendRate?: number }) {
    setBusyId(body.providerId);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as {
        state?: RatesStoreState;
        error?: string;
      };
      if (payload.state) {
        setState(payload.state);
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

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-zinc-500 uppercase">
            Admin
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
            Rate collection
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
            Run each provider separately. The public heatmap only reads stored
            quotes; it does not scrape provider sites.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/"
            className="rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            View heatmap
          </Link>
          <button
            type="button"
            onClick={() => postRates({ providerId: "all" })}
            disabled={busyId != null}
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {busyId === "all" ? "Refreshing…" : "Refresh wired"}
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
                    <div className="font-medium text-zinc-900">{record.name}</div>
                    <div className="text-xs text-zinc-500">
                      {record.sourceUrl ? (
                        <a
                          href={record.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="underline decoration-zinc-300 hover:text-zinc-800"
                        >
                          {record.sourceUrl}
                        </a>
                      ) : (
                        "Source not wired yet"
                      )}
                    </div>
                    {record.error ? (
                      <div className="mt-1 text-xs text-red-600">{record.error}</div>
                    ) : null}
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
                      className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
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
                        <p className="w-full text-xs text-zinc-600">
                          Server fetch is blocked by their site. Open the page,
                          copy the number next to{" "}
                          <span className="font-medium">1 GBP = … LKR</span>,
                          then save it here.
                        </p>
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
