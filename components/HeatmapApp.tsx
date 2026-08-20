"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { RateHeatmap } from "@/components/RateHeatmap";
import { ProviderLogo } from "@/components/ProviderLogo";
import {
  bestQuoteForAmount,
  formatCompactGbp,
  parseSendAmount,
} from "@/lib/best-send";
import type { ComparisonRates } from "@/lib/providers/types";

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

export function HeatmapApp({ data }: { data: ComparisonRates }) {
  const [rawAmount, setRawAmount] = useState("1000");
  const amountGbp = parseSendAmount(rawAmount);
  const pick = useMemo(
    () => (amountGbp == null ? null : bestQuoteForAmount(data, amountGbp)),
    [amountGbp, data],
  );

  return (
    <>
      <header className="flex shrink-0 items-center gap-3 border-b border-zinc-100 px-3 py-2 sm:px-4">
        <div className="min-w-0 shrink-0">
          <h1 className="truncate text-sm font-semibold tracking-tight text-zinc-900">
            UK → Sri Lanka
          </h1>
          <p className="hidden truncate text-[11px] text-zinc-500 sm:block">
            Effective LKR per £1, by send amount
          </p>
        </div>

        <form
          className="flex min-w-0 flex-1 items-center justify-center gap-2"
          onSubmit={(event) => event.preventDefault()}
        >
          <label
            htmlFor="send-amount"
            className="shrink-0 text-[11px] font-medium text-zinc-500"
          >
            Send
          </label>
          <div className="flex items-center rounded-md border border-zinc-200 bg-zinc-50 focus-within:border-zinc-400">
            <span className="pl-2 text-xs text-zinc-500">£</span>
            <input
              id="send-amount"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={rawAmount}
              onChange={(event) => setRawAmount(event.target.value)}
              placeholder="1,000"
              className="w-[5.5rem] bg-transparent px-1.5 py-1 text-sm tabular-nums text-zinc-900 outline-none sm:w-24"
            />
          </div>
        </form>

        <div className="flex min-w-0 items-center gap-3">
          {pick ? (
            <div className="flex min-w-0 items-center gap-2">
              <ProviderLogo
                id={pick.provider.id}
                name={pick.provider.name}
                size={28}
              />
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold leading-tight text-zinc-900">
                  Best · {pick.provider.name}
                </p>
                <p className="truncate font-mono text-[11px] tabular-nums text-zinc-500">
                  {formatRate(pick.quote.effectiveRate)}
                  {" · "}
                  {formatLkr(pick.estimatedLkr)} LKR
                  {pick.column.amountGbp !== amountGbp
                    ? ` · from ${formatCompactGbp(pick.column.amountGbp)}`
                    : null}
                </p>
              </div>
            </div>
          ) : (
            <p className="hidden text-[11px] text-zinc-400 sm:block">
              Type an amount to see the best rate
            </p>
          )}
          <Link
            href="/admin"
            className="shrink-0 rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
          >
            Admin
          </Link>
        </div>
      </header>
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden px-2 py-2 sm:px-3 sm:py-3">
        <RateHeatmap data={data} activeAmountGbp={pick?.column.amountGbp} />
      </div>
    </>
  );
}
