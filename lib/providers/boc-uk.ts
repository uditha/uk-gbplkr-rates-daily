import { SEND_AMOUNTS } from "./amounts";
import type { ProviderSnapshot, Quote } from "./types";

export const BOC_UK_RATES_URL = "https://bankofceylon.co.uk/rates/";
export const BOC_UK_PROVIDER_ID = "remitwire-boc-uk";
export const BOC_UK_PROVIDER_NAME = "RemitWire (BOC UK)";

const USER_AGENT =
  "Mozilla/5.0 (compatible; uk-gbplkr-rates/1.0; +https://github.com/uditha/uk-gbplkr-rates-daily)";

export function bocUkFeeGbp(amountGbp: number): number {
  if (amountGbp <= 0) {
    throw new Error("Send amount must be positive");
  }
  if (amountGbp <= 1000) return 3;
  if (amountGbp <= 5000) return 5;
  if (amountGbp <= 20000) return 10;
  if (amountGbp <= 50000) return 20;
  if (amountGbp <= 100000) return 25;
  return 30;
}

export function parseNumber(value: string): number {
  const parsed = Number(value.replace(/,/g, "").trim());
  if (!Number.isFinite(parsed)) {
    throw new Error(`Could not parse number: ${value}`);
  }
  return parsed;
}

export function parseBocUkRatesPage(html: string): {
  buyingRate: number;
  sellingRate: number;
  asOf: string | null;
} {
  const gbpLkrRow = html.match(
    /GBP\s*\/[\s\S]{0,500}?LKR[\s\S]{0,200}?column-2">\s*([\d.,]+)\s*<\/td>\s*<td[^>]*column-3">\s*([\d.,]+)/i,
  );

  if (!gbpLkrRow) {
    throw new Error("Could not find GBP/LKR buying rate on BOC UK rates page");
  }

  const asOfMatch = html.match(/Rate as of:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);

  return {
    buyingRate: parseNumber(gbpLkrRow[1]),
    sellingRate: parseNumber(gbpLkrRow[2]),
    asOf: asOfMatch?.[1] ?? null,
  };
}

export function quoteForAmount(
  amountGbp: number,
  buyingRate: number,
): Quote {
  const feeGbp = bocUkFeeGbp(amountGbp);
  const netGbp = amountGbp - feeGbp;
  const lkrReceived = netGbp * buyingRate;
  const effectiveRate = lkrReceived / amountGbp;

  return {
    amountGbp,
    feeGbp,
    netGbp,
    lkrReceived,
    effectiveRate,
    behindBoardRate: buyingRate - effectiveRate,
  };
}

export function buildBocUkSnapshot(
  buyingRate: number,
  asOf: string | null,
): ProviderSnapshot {
  return {
    id: BOC_UK_PROVIDER_ID,
    name: BOC_UK_PROVIDER_NAME,
    sourceUrl: BOC_UK_RATES_URL,
    pair: "GBPLKR",
    boardRate: buyingRate,
    rateKind: "buying",
    asOf,
    quotes: SEND_AMOUNTS.map((column) =>
      quoteForAmount(column.amountGbp, buyingRate),
    ),
  };
}

export async function fetchBocUkHtml(): Promise<string> {
  const response = await fetch(BOC_UK_RATES_URL, {
    cache: "no-store",
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": USER_AGENT,
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`BOC UK rates page returned ${response.status}`);
  }

  return response.text();
}

export async function fetchBocUkSnapshot(): Promise<ProviderSnapshot> {
  const html = await fetchBocUkHtml();
  const { buyingRate, asOf } = parseBocUkRatesPage(html);
  return buildBocUkSnapshot(buyingRate, asOf);
}
