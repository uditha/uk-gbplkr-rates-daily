import type {
  AmountColumn,
  ComparisonRates,
  ProviderSnapshot,
  Quote,
} from "@/lib/providers/types";

export type BestSendPick = {
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

function bestAtColumn(data: ComparisonRates, columnIndex: number) {
  let best: { provider: ProviderSnapshot; quote: Quote } | null = null;

  for (const provider of data.providers) {
    const quote = provider.quotes[columnIndex];
    if (!quote) continue;
    if (
      !best ||
      quote.effectiveRate > best.quote.effectiveRate ||
      (quote.effectiveRate === best.quote.effectiveRate &&
        quote.lkrReceived > best.quote.lkrReceived)
    ) {
      best = { provider, quote };
    }
  }

  return best;
}

export function bestQuoteForAmount(
  data: ComparisonRates,
  amountGbp: number,
): BestSendPick | null {
  if (!Number.isFinite(amountGbp) || amountGbp <= 0) return null;

  for (const { column, index } of columnsNearestFirst(data.amounts, amountGbp)) {
    const winner = bestAtColumn(data, index);
    if (!winner) continue;
    return {
      ...winner,
      column,
      estimatedLkr: winner.quote.lkrReceived * (amountGbp / winner.quote.amountGbp),
    };
  }

  return null;
}
