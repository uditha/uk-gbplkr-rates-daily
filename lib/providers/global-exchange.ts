import { SEND_AMOUNTS } from "./amounts";
import { BROWSER_USER_AGENT } from "./http";
import type { ProviderSnapshot, Quote } from "./types";

export const GLOBAL_EXCHANGE_RATES_URL =
  "https://www.globalexchange.co.uk/Send-Money-to-SriLanka";
export const GLOBAL_EXCHANGE_QUOTE_URL =
  "https://www.globalexchange.co.uk/calculate_currency";
export const GLOBAL_EXCHANGE_PROVIDER_ID = "global-exchange-smart";
export const GLOBAL_EXCHANGE_PROVIDER_NAME = "Global Exchange (Smart)";

const USER_AGENT = BROWSER_USER_AGENT;

/** GBP/LKR remittance board rates sit in this band; skip calculator leftovers like 1.00. */
const MIN_SEND_RATE = 200;
const MAX_SEND_RATE = 800;

export type GlobalExchangeQuote = {
  sendRate: number;
  quantityGbp: number;
  lkrReceived: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function looksLikeCloudflare(html: string) {
  return /just a moment|cf-challenge|challenge-platform/i.test(html);
}

function isCloudflareChallenge(body: string) {
  return (
    /<title>\s*just a moment/i.test(body) ||
    (/just a moment/i.test(body) &&
      /enable javascript and cookies to continue/i.test(body))
  );
}

function parseRateNumber(value: string): number | null {
  const sendRate = Number(value.replace(/,/g, ""));
  if (
    !Number.isFinite(sendRate) ||
    sendRate < MIN_SEND_RATE ||
    sendRate > MAX_SEND_RATE
  ) {
    return null;
  }
  return sendRate;
}

function parseRateString(value: string): number | null {
  const match = value.match(/1\s*GBP\s*=\s*([\d][\d.,]*)\s*LKR/i);
  return match ? parseRateNumber(match[1]) : null;
}

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
  const fromRateString = html.match(/"rate_string"\s*:\s*"([^"]+)"/i);
  if (fromRateString) {
    const sendRate = parseRateString(fromRateString[1].replace(/\\u003d/g, "="));
    if (sendRate != null) return { sendRate };
  }

  // Only allow tags/whitespace between "1 GBP =", the figure, and "LKR" so a
  // nearby INR/USD quote or the £1 calculator leftover cannot win.
  const matches = html.matchAll(
    /1\s*GBP\s*=(?:\s|<[^>]+>)*([\d][\d.,]*)(?:\s|<[^>]+>)*LKR/gi,
  );
  for (const match of matches) {
    const sendRate = parseRateNumber(match[1]);
    if (sendRate != null) return { sendRate };
  }

  if (looksLikeCloudflare(html)) {
    throw new Error(
      "Global Exchange page was blocked by Cloudflare; open the Sri Lanka page or homepage calculator and save the 1 GBP = LKR rate below.",
    );
  }

  throw new Error(
    "Could not find 1 GBP = … LKR on the Global Exchange Sri Lanka page",
  );
}

export function parseGlobalExchangeQuote(
  payload: unknown,
  quantityGbp = 1,
): GlobalExchangeQuote {
  if (!isRecord(payload)) {
    throw new Error("Global Exchange calculator was not JSON");
  }

  const rateString =
    typeof payload.rate_string === "string" ? payload.rate_string : "";
  let sendRate = rateString ? parseRateString(rateString) : null;

  const exchangeRaw =
    typeof payload.exchange === "number"
      ? payload.exchange
      : typeof payload.exchange === "string"
        ? Number(payload.exchange.replace(/,/g, ""))
        : NaN;
  const lkrReceived = Number.isFinite(exchangeRaw) ? exchangeRaw : null;

  if (sendRate == null && lkrReceived != null && quantityGbp > 0) {
    sendRate = parseRateNumber((lkrReceived / quantityGbp).toFixed(4));
  }

  if (sendRate == null) {
    throw new Error(
      `Could not parse Global Exchange send rate from ${rateString || payload.exchange}`,
    );
  }

  return { sendRate, quantityGbp, lkrReceived };
}

export function quoteGlobalExchangeAmount(
  amountGbp: number,
  sendRate: number,
): Quote {
  const feeGbp = globalExchangeFeeGbp(amountGbp);
  const netGbp = amountGbp - feeGbp;
  const lkrReceived = netGbp * sendRate;
  const effectiveRate = lkrReceived / amountGbp;

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

function blockedByTheirSite(status: number, body: string) {
  return status === 403 || isCloudflareChallenge(body);
}

const BLOCKED_MESSAGE =
  "Their site blocked the server. Open the homepage calculator or Sri Lanka page and save the 1 GBP = LKR rate below.";

export async function fetchGlobalExchangeQuote(
  quantityGbp = 1,
): Promise<unknown> {
  const response = await fetch(GLOBAL_EXCHANGE_QUOTE_URL, {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json, text/javascript, */*; q=0.01",
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      Origin: "https://www.globalexchange.co.uk",
      Referer: "https://www.globalexchange.co.uk/",
      "User-Agent": USER_AGENT,
      "X-Requested-With": "XMLHttpRequest",
    },
    body: new URLSearchParams({
      send_code: "GBP",
      dest_code: "LKR",
      quantity: String(quantityGbp),
    }),
    signal: AbortSignal.timeout(15000),
  });

  const body = await response.text();
  if (!response.ok || blockedByTheirSite(response.status, body)) {
    throw new Error(BLOCKED_MESSAGE);
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new Error("Global Exchange calculator did not return JSON");
  }
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

  const html = await response.text();
  if (!response.ok || blockedByTheirSite(response.status, html)) {
    throw new Error(BLOCKED_MESSAGE);
  }

  return html;
}

export async function fetchGlobalExchangeSnapshot(): Promise<ProviderSnapshot> {
  const asOf = new Date().toLocaleDateString("en-GB");

  try {
    const payload = await fetchGlobalExchangeQuote(1);
    const { sendRate } = parseGlobalExchangeQuote(payload, 1);
    return buildGlobalExchangeSnapshot(sendRate, asOf);
  } catch (error) {
    const calculatorError =
      error instanceof Error ? error.message : "Calculator failed";
    try {
      const html = await fetchGlobalExchangeHtml();
      const { sendRate } = parseGlobalExchangeSriLankaPage(html);
      return buildGlobalExchangeSnapshot(sendRate, asOf);
    } catch {
      throw new Error(calculatorError);
    }
  }
}
