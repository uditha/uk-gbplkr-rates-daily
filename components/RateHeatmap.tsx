import {
  HEATMAP_MAX,
  HEATMAP_TICKS,
  colorForBehind,
  heatmapGradient,
} from "@/lib/heatmap";
import { WISE_PROVIDER_ID } from "@/lib/providers/wise";
import { REVOLUT_PROVIDER_ID } from "@/lib/providers/revolut";
import { RIA_PROVIDER_ID } from "@/lib/providers/ria";
import type { ComparisonRates, Quote } from "@/lib/providers/types";
import { ProviderLogo } from "@/components/ProviderLogo";

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

export function RateHeatmap({ data }: { data: ComparisonRates }) {
  const compareAcrossProviders = data.providers.length > 1;
  const leaders = data.amounts.map((_, column) => {
    const values = data.providers
      .map((provider) => provider.quotes[column]?.effectiveRate)
      .filter((rate): rate is number => rate != null);
    return values.length ? Math.max(...values) : null;
  });

  return (
    <div className="flex h-full min-h-0 w-full items-stretch gap-4">
      <div className="min-h-0 min-w-0 flex-1 overflow-auto">
        <div
          className="grid h-full min-h-[12rem] min-w-[48rem] gap-x-1 gap-y-1.5"
          style={{
            gridTemplateColumns: `max-content repeat(${data.amounts.length}, minmax(4.25rem, 1fr))`,
            gridTemplateRows: `auto repeat(${data.providers.length}, minmax(4.25rem, 1fr))`,
          }}
        >
          <div className="sticky left-0 top-0 z-30 bg-white" />
          {data.amounts.map((amount) => (
            <div
              key={amount.amountGbp}
              className="sticky top-0 z-20 bg-white px-1 pb-2 text-center text-[11px] font-medium text-zinc-500"
            >
              £{amount.label}
            </div>
          ))}

          {data.providers.map((provider) => (
            <div key={provider.id} className="contents">
              <div className="sticky left-0 z-10 flex max-w-[11.25rem] items-center gap-2 bg-white py-0.5 pr-2">
                <ProviderLogo id={provider.id} name={provider.name} size={28} />
                <div className="min-w-0">
                  <span className="block text-[12px] font-medium leading-tight text-zinc-800">
                    {provider.name}
                  </span>
                  <span className="mt-0.5 block font-mono text-[10px] tabular-nums text-zinc-500">
                    {formatRate(provider.boardRate)}
                    {provider.rateKind === "buying" ? " buy" : ""}
                    {provider.asOf ? ` · ${provider.asOf}` : ""}
                  </span>
                </div>
              </div>
              {data.amounts.map((amount, column) => {
                const quote = provider.quotes[column] ?? null;
                if (!quote) {
                  return (
                    <UnavailableCell
                      key={`${provider.id}-${amount.amountGbp}`}
                      label={amount.label}
                      providerName={provider.name}
                      caption={
                        provider.id === WISE_PROVIDER_ID ||
                        provider.id === REVOLUT_PROVIDER_ID
                          ? "max 5M"
                          : provider.id === RIA_PROVIDER_ID
                            ? "max 8k"
                            : "n/a"
                      }
                    />
                  );
                }
                return (
                  <HeatmapCell
                    key={`${provider.id}-${quote.amountGbp}`}
                    quote={quote}
                    leader={leaders[column]}
                    compareAcrossProviders={compareAcrossProviders}
                    label={amount.label}
                    providerName={provider.name}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <HeatmapLegend />
    </div>
  );
}

function unavailableReason(caption: string) {
  if (caption === "max 5M") return "over the 5 million LKR send limit";
  if (caption === "max 8k") return "over Ria’s £8,000 send limit";
  return "no quote";
}

function UnavailableCell({
  label,
  providerName,
  caption,
}: {
  label: string;
  providerName: string;
  caption: string;
}) {
  return (
    <div
      title={`${providerName} £${label}: ${unavailableReason(caption)}`}
      className="flex h-full min-h-0 flex-col items-center justify-center rounded-lg bg-zinc-50 px-1 py-1.5 text-center text-zinc-400 ring-1 ring-zinc-100"
    >
      <span className="font-mono text-[13px] font-semibold tabular-nums leading-none sm:text-sm">
        —
      </span>
      <span className="mt-1 font-mono text-[10px] tabular-nums leading-none sm:text-[11px]">
        {caption}
      </span>
    </div>
  );
}

function HeatmapCell({
  quote,
  leader,
  compareAcrossProviders,
  label,
  providerName,
}: {
  quote: Quote;
  leader: number | null | undefined;
  compareAcrossProviders: boolean;
  label: string;
  providerName: string;
}) {
  const behind = Number(
    (compareAcrossProviders && leader != null
      ? leader - quote.effectiveRate
      : quote.behindBoardRate
    ).toFixed(2),
  );
  const isLeader = behind === 0;
  const { background, color } = colorForBehind(behind);
  const rankHint = isLeader
    ? "best in this column. "
    : behind > 0
      ? `${behind.toFixed(2)} LKR/£ behind the leader. `
      : "";

  return (
    <div
      title={`${providerName} £${label}: ${rankHint}fee £${quote.feeGbp}, recipient ${formatLkr(quote.lkrReceived)} LKR, effective ${formatRate(quote.effectiveRate)}`}
      className="relative flex h-full min-h-0 flex-col items-center justify-center rounded-lg px-1 py-1.5 text-center"
      style={{
        background,
        color,
        boxShadow: isLeader ? "inset 0 0 0 2px rgba(255,255,255,0.7)" : undefined,
      }}
    >
      <span className="font-mono text-[13px] font-semibold tabular-nums leading-none sm:text-sm">
        {formatRate(quote.effectiveRate)}
      </span>
      <span className="mt-1 font-mono text-[10px] tabular-nums leading-none opacity-90 sm:text-[11px]">
        {formatLkr(quote.lkrReceived)}
      </span>
    </div>
  );
}

function HeatmapLegend() {
  return (
    <div className="hidden h-full min-h-0 shrink-0 pr-1 sm:flex sm:flex-col">
      <p className="mb-2 max-w-[7rem] text-[11px] leading-tight text-zinc-500">
        Green is the best rate in that column
      </p>
      <div className="flex min-h-0 flex-1 items-stretch gap-2">
        <div
          className="w-2.5 rounded-full"
          style={{ background: heatmapGradient() }}
        />
        <div className="relative w-10">
          {HEATMAP_TICKS.map((tick) => (
            <span
              key={tick.value}
              className="absolute left-0 -translate-y-1/2 font-mono text-[11px] tabular-nums text-zinc-500"
              style={{ top: `${(tick.value / HEATMAP_MAX) * 100}%` }}
            >
              {tick.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
