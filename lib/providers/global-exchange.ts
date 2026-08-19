import { SEND_AMOUNTS } from "./amounts";
import type { ProviderSnapshot, Quote } from "./types";

export const GLOBAL_EXCHANGE_RATES_URL =
  "https://www.globalexchange.co.uk/Send-Money-to-SriLanka";
export const GLOBAL_EXCHANGE_PROVIDER_ID = "global-exchange-smart";
export const GLOBAL_EXCHANGE_PROVIDER_NAME = "Global Exchange (Smart)";

const USER_AGENT =
  "Mozilla/5.0 (compatible; uk-gbplkr-rates/1.0; +https://github.com/uditha/uk-gbplkr-rates-daily)";

export function globalExchangeFeeGbp(amountGbp: number): number {
  if (amountGbp <= 0) {
    throw new Error("Send amount must be positive");
  }
  if (amountGbp <= 1000) return 3;
  return 5;
}

export function parseGlobalExchangeSriLankaPage(html: string): {
  sendRate: number;
} {
  if (/just a moment|cf-challenge|challenge-platform/i.test(html)) {
    throw new Error(
      "Global Exchange page was blocked by Cloudflare; try refresh from /admin after the page is reachable",
    );
  }

  const match = html.match(/1\s*GBP\s*=[\s\S]{0,240}?([\d][\d.,]*)\s*LKR/i);
  if (!match) {
    throw new Error(
      "Could not find 1 GBP = … LKR on the Global Exchange Sri Lanka page",
    );
  }

  const sendRate = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(sendRate) || sendRate <= 0) {
    throw new Error(`Could not parse Global Exchange send rate: ${match[1]}`);
  }

  return { sendRate };
}

export function quoteGlobalExchangeAmount(
  amountGbp: number,
  sendRate: number,
): Quote {
  const feeGbp = globalExchangeFeeGbp(amountGbp);
  const netGbp = amountGbp;
  const lkrReceived = netGbp * sendRate;
  const totalPaidGbp = amountGbp + feeGbp;
  const effectiveRate = lkrReceived / totalPaidGbp;

  return {
    amountGbp,
    feeGbp,
    netGbp,
    lkrReceived,
    effectiveRate,
    behindBoardRate: sendRate - effectiveRate,
  };
}

export function buildGlobalExchangeSnapshot(
  sendRate: number,
  asOf: string | null = null,
): ProviderSnapshot {
  return {
    id: GLOBAL_EXCHANGE_PROVIDER_ID,
    name: GLOBAL_EXCHANGE_PROVIDER_NAME,
    sourceUrl: GLOBAL_EXCHANGE_RATES_URL,
    pair: "GBPLKR",
    boardRate: sendRate,
    rateKind: "send",
    asOf,
    quotes: SEND_AMOUNTS.map((column) =>
      quoteGlobalExchangeAmount(column.amountGbp, sendRate),
    ),
  };
}

export async function fetchGlobalExchangeHtml(): Promise<string> {
  const response = await fetch(GLOBAL_EXCHANGE_RATES_URL, {
    cache: "no-store",
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": USER_AGENT,
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Global Exchange Sri Lanka page returned ${response.status}`);
  }

  return response.text();
}

export async function fetchGlobalExchangeSnapshot(): Promise<ProviderSnapshot> {
  const html = await fetchGlobalExchangeHtml();
  const { sendRate } = parseGlobalExchangeSriLankaPage(html);
  return buildGlobalExchangeSnapshot(sendRate);
}
