import type {
  AmountColumn,
  ComparisonRates,
  ProviderSnapshot,
  Quote,
} from "@/lib/providers/types";

export type BestSendPick = {
  rank: number;
  provider: ProviderSnapshot;
  quote: Quote;
  column: AmountColumn;
  estimatedLkr: number;
};

export function parseSendAmount(raw: string): number | null {
  const text = raw.trim().replace(/£/g, "").replace(/,/g, "").replace(/\s/g, "");
  if (!text) return null;

  const thousandMatch = text.match(/^(\d+(?:\.\d+)?)k$/i);
  const amount = thousandMatch ? Number(thousandMatch[1]) * 1000 : Number(text);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount;
}

export function formatCompactGbp(amountGbp: number) {
  if (amountGbp >= 1000) {
    const thousands = amountGbp / 1000;
    const compact = Number.isInteger(thousands)
      ? String(thousands)
      : thousands.toFixed(1).replace(/\.0$/, "");
    return `£${compact}k`;
  }
  return `£${amountGbp}`;
}

function columnDistance(column: AmountColumn, amountGbp: number) {
  return Math.abs(column.amountGbp - amountGbp);
}

function columnsNearestFirst(amounts: AmountColumn[], amountGbp: number) {
  return amounts
    .map((column, index) => ({ column, index }))
    .sort((a, b) => {
      const byDistance =
        columnDistance(a.column, amountGbp) - columnDistance(b.column, amountGbp);
      if (byDistance !== 0) return byDistance;
      return a.column.amountGbp - b.column.amountGbp;
    });
}

function compareQuotes(a: Quote, b: Quote) {
  if (b.effectiveRate !== a.effectiveRate) {
    return b.effectiveRate - a.effectiveRate;
  }
  return b.lkrReceived - a.lkrReceived;
}

function rankedAtColumn(data: ComparisonRates, columnIndex: number) {
  return data.providers
    .map((provider) => ({
      provider,
      quote: provider.quotes[columnIndex],
    }))
    .filter(
      (row): row is { provider: ProviderSnapshot; quote: Quote } =>
        row.quote != null,
    )
    .sort((a, b) => compareQuotes(a.quote, b.quote));
}

export function topQuotesForAmount(
  data: ComparisonRates,
  amountGbp: number,
  limit = 5,
): BestSendPick[] {
  if (!Number.isFinite(amountGbp) || amountGbp <= 0) return [];

  for (const { column, index } of columnsNearestFirst(data.amounts, amountGbp)) {
    const ranked = rankedAtColumn(data, index);
    if (ranked.length === 0) continue;
    return ranked.slice(0, limit).map((row, rank) => ({
      ...row,
      rank: rank + 1,
      column,
      estimatedLkr: row.quote.lkrReceived * (amountGbp / row.quote.amountGbp),
    }));
  }

  return [];
}

export function bestQuoteForAmount(
  data: ComparisonRates,
  amountGbp: number,
): BestSendPick | null {
  return topQuotesForAmount(data, amountGbp, 1)[0] ?? null;
}
