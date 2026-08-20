"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RateHeatmap, HEATMAP_NAME_COLUMN } from "@/components/RateHeatmap";
import { ProviderLogo } from "@/components/ProviderLogo";
import {
  formatCompactGbp,
  parseSendAmount,
  topQuotesForAmount,
  type BestSendPick,
} from "@/lib/best-send";
import type { ComparisonRates } from "@/lib/providers/types";
import { comparisonRatesFromStore } from "@/lib/providers";
import {
  loadBrowserRates,
  newerRates,
  subscribeBrowserStore,
} from "@/lib/store/browser-rates";

function formatRate(rate: number) {
  return rate.toFixed(2);
}

function formatLkr(amount: number) {
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(2)}M`;
  }
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

const RANK_BADGE = [
  "bg-emerald-700 text-white",
  "bg-zinc-600 text-white",
  "bg-zinc-500 text-white",
  "bg-zinc-400 text-white",
  "bg-zinc-300 text-zinc-700",
] as const;

function RankedPick({ pick }: { pick: BestSendPick }) {
  const badge = RANK_BADGE[pick.rank - 1] ?? RANK_BADGE[4];

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1.5">
      <span
        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums ${badge}`}
      >
        {pick.rank}
      </span>
      <ProviderLogo id={pick.provider.id} name={pick.provider.name} size={22} />
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold leading-tight text-zinc-900">
          {pick.provider.name}
        </p>
        <p className="truncate font-mono text-[11px] tabular-nums text-zinc-500">
          {formatRate(pick.quote.effectiveRate)}
          <span className="text-zinc-300"> · </span>
          {formatLkr(pick.estimatedLkr)} LKR
        </p>
      </div>
    </div>
  );
}

export function HeatmapApp({ data: seed }: { data: ComparisonRates | null }) {
  const [data, setData] = useState(seed);
  const [rawAmount, setRawAmount] = useState("1000");

  useEffect(() => {
    let cancelled = false;

    async function hydrateLatestRates() {
      const local = loadBrowserRates();
      let remote: ComparisonRates | null = null;
      try {
        const response = await fetch("/api/rates", { cache: "no-store" });
        if (response.ok) {
          remote = (await response.json()) as ComparisonRates;
        }
      } catch {
        // Keep whichever snapshot is already on this device.
      }

      const newest = newerRates(newerRates(seed, local), remote);
      if (cancelled || !newest) return;
      setData(newest);
    }

    void hydrateLatestRates();
    return () => {
      cancelled = true;
    };
  }, [seed]);

  useEffect(() => subscribeBrowserStore((state) => {
    const rates = comparisonRatesFromStore(state);
    setData((current) => newerRates(current, rates));
  }), []);

  const amountGbp = parseSendAmount(rawAmount);
  const picks = useMemo(
    () =>
      data && amountGbp != null ? topQuotesForAmount(data, amountGbp) : [],
    [amountGbp, data],
  );
  const snappedFrom =
    amountGbp != null &&
    picks[0] &&
    picks[0].column.amountGbp !== amountGbp
      ? formatCompactGbp(picks[0].column.amountGbp)
      : null;

  return (
    <>
      <header className="flex shrink-0 items-center gap-1 border-b border-zinc-100 px-3 py-2">
        <div
          className="min-w-0 shrink-0 pr-2"
          style={{ width: HEATMAP_NAME_COLUMN }}
        >
          <h1 className="truncate text-sm font-semibold tracking-tight text-zinc-900">
            UK → Sri Lanka
          </h1>
          <p className="hidden truncate text-[11px] text-zinc-500 sm:block">
            Effective LKR per £1
          </p>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-stretch overflow-hidden rounded-xl bg-zinc-50 shadow-[inset_0_0_0_1px_rgba(24,24,27,0.08)]">
            <form
              className="flex shrink-0 items-center gap-1.5 py-1.5 pl-3 pr-2"
              onSubmit={(event) => event.preventDefault()}
            >
              <label
                htmlFor="send-amount"
                className="shrink-0 text-[11px] font-medium text-zinc-500"
              >
                Send
              </label>
              <div className="flex items-center rounded-md bg-white px-1.5 shadow-[inset_0_0_0_1px_rgba(24,24,27,0.1)] focus-within:shadow-[inset_0_0_0_1.5px_rgb(4,120,87)]">
                <span className="text-xs font-medium text-zinc-400">£</span>
                <input
                  id="send-amount"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={rawAmount}
                  onChange={(event) => setRawAmount(event.target.value)}
                  placeholder="1,000"
                  className="w-[4.75rem] bg-transparent px-1 py-1 text-sm font-medium tabular-nums text-zinc-900 outline-none sm:w-[5.5rem]"
                />
              </div>
            </form>

            <div className="my-1.5 w-px shrink-0 bg-zinc-200" />

            <div className="flex min-w-0 flex-1 items-stretch divide-x divide-zinc-200 bg-white/80">
              {picks.length > 0 ? (
                picks.map((pick) => (
                  <RankedPick key={pick.provider.id} pick={pick} />
                ))
              ) : (
                <p className="px-3 py-1.5 text-[11px] text-zinc-400">
                  Type an amount to see the top rates
                </p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {snappedFrom ? (
              <span className="hidden text-[10px] text-zinc-400 sm:inline">
                from {snappedFrom}
              </span>
            ) : null}
            <Link
              href="/admin"
              className="rounded-md px-2.5 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700"
            >
              Admin
            </Link>
          </div>
        </div>
      </header>
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden px-3 pb-3 pt-2">
        {data ? (
          <RateHeatmap
            data={data}
            activeAmountGbp={picks[0]?.column.amountGbp}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center">
            <p className="max-w-md text-sm text-zinc-600">
              No stored rates yet. Refresh a provider from{" "}
              <Link className="underline" href="/admin">
                /admin
              </Link>
              .
            </p>
          </div>
        )}
      </div>
    </>
  );
}
