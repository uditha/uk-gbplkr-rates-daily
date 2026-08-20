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
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-100 px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0 shrink-0">
            <h1 className="truncate text-sm font-semibold tracking-tight text-zinc-900">
              UK → Sri Lanka
            </h1>
            <p className="hidden truncate text-[11px] text-zinc-500 sm:block">
              Effective LKR per £1
            </p>
          </div>

          <div className="flex min-w-0 items-stretch overflow-hidden rounded-xl bg-zinc-50 shadow-[inset_0_0_0_1px_rgba(24,24,27,0.08)]">
            <form
              className="flex items-center gap-1.5 py-1.5 pl-3 pr-2"
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

            <div className="flex min-w-0 items-center gap-2 bg-white/80 py-1.5 pl-2.5 pr-3">
              {pick ? (
                <>
                  <ProviderLogo
                    id={pick.provider.id}
                    name={pick.provider.name}
                    size={28}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-xs leading-tight">
                      <span className="font-semibold text-emerald-700">Best</span>
                      <span className="text-zinc-300"> · </span>
                      <span className="font-semibold text-zinc-900">
                        {pick.provider.name}
                      </span>
                    </p>
                    <p className="truncate font-mono text-[11px] tabular-nums text-zinc-500">
                      {formatRate(pick.quote.effectiveRate)}
                      <span className="text-zinc-300"> · </span>
                      {formatLkr(pick.estimatedLkr)} LKR
                      {amountGbp != null &&
                      pick.column.amountGbp !== amountGbp ? (
                        <span className="text-zinc-400">
                          {` · from ${formatCompactGbp(pick.column.amountGbp)}`}
                        </span>
                      ) : null}
                    </p>
                  </div>
                </>
              ) : (
                <p className="text-[11px] text-zinc-400">
                  Type an amount to see the best rate
                </p>
              )}
            </div>
          </div>
        </div>

        <Link
          href="/admin"
          className="shrink-0 rounded-md px-2.5 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700"
        >
          Admin
        </Link>
      </header>
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden px-2 py-2 sm:px-3 sm:py-3">
        <RateHeatmap data={data} activeAmountGbp={pick?.column.amountGbp} />
      </div>
    </>
  );
}
