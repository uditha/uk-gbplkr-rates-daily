import { SEND_AMOUNTS } from "./amounts";
import {
  GLOBAL_EXCHANGE_CALCULATE_URL,
  GLOBAL_EXCHANGE_HOME_URL,
  GLOBAL_EXCHANGE_PROVIDER_ID,
  GLOBAL_EXCHANGE_PROVIDER_NAME,
  GLOBAL_EXCHANGE_RATES_URL,
  GLOBAL_EXCHANGE_READER_PREFIX,
} from "./global-exchange-meta";
import {
  BROWSER_NAVIGATE_HEADERS,
  BROWSER_USER_AGENT,
  isCloudflareChallenge,
  isUsableHtmlDocument,
} from "./http";
import type { ProviderSnapshot, Quote } from "./types";

export {
  GLOBAL_EXCHANGE_CALCULATE_URL,
  GLOBAL_EXCHANGE_HOME_URL,
  GLOBAL_EXCHANGE_PROVIDER_ID,
  GLOBAL_EXCHANGE_PROVIDER_NAME,
  GLOBAL_EXCHANGE_RATES_URL,
  GLOBAL_EXCHANGE_READER_PREFIX,
} from "./global-exchange-meta";

const USER_AGENT = BROWSER_USER_AGENT;
const BLOCKED_MESSAGE =
  "Their site blocked the server (403). Open the Sri Lanka page and save the 1 GBP = LKR rate below.";

type FetchedDocument = {
  html: string;
  cookies: string;
  viaReader: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readerUrl(url: string): string {
  return `${GLOBAL_EXCHANGE_READER_PREFIX}${url}`;
}

function readCookies(response: Response): string {
  const raw =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie")].filter(
          (value): value is string => Boolean(value),
        );
  return raw
    .map((cookie) => cookie.split(";", 1)[0]?.trim())
    .filter((value): value is string => Boolean(value))
    .join("; ");
}

function readCsrfToken(html: string): string | null {
  const match = html.match(/name="csrf-token"\s+content="([^"]+)"/i);
  return match?.[1] ?? null;
}

function parseGbpLkrRate(text: string): number | null {
  const match = text.match(/1\s*GBP\s*=[\s\S]{0,400}?([\d][\d.,]*)\s*LKR/i);
  if (!match) return null;
  const sendRate = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(sendRate) && sendRate > 0 ? sendRate : null;
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
  const sendRate = parseGbpLkrRate(html);
  if (sendRate != null) {
    return { sendRate };
  }

  if (isCloudflareChallenge(html) || /challenge-platform/i.test(html)) {
    throw new Error(
      "Global Exchange page was blocked by Cloudflare; open the Sri Lanka page and save the 1 GBP = LKR rate below.",
    );
  }

  throw new Error(
    "Could not find 1 GBP = … LKR on the Global Exchange Sri Lanka page",
  );
}

export function parseGlobalExchangeCalculate(payload: unknown): {
  sendRate: number;
  asOf: string | null;
} {
  if (!isRecord(payload)) {
    throw new Error("Global Exchange calculator was not JSON");
  }

  const sendRate = parseGbpLkrRate(String(payload.rate_string ?? ""));
  if (sendRate == null) {
    throw new Error("Global Exchange calculator had no 1 GBP = LKR rate");
  }

  let asOf: string | null = null;
  if (typeof payload.last_updated === "string" && payload.last_updated) {
    const parsed = new Date(payload.last_updated);
    if (!Number.isNaN(parsed.getTime())) {
      asOf = parsed.toLocaleDateString("en-GB", { timeZone: "Europe/London" });
    }
  }

  return { sendRate, asOf };
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

function todayAsOf(): string {
  return new Date().toLocaleDateString("en-GB");
}

async function fetchWithFetch(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<{ status: number; html: string; cookies: string } | null> {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
    return {
      status: response.status,
      html: await response.text(),
      cookies: readCookies(response),
    };
  } catch {
    return null;
  }
}

async function getHtmlDocument(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<{ status: number; html: string; cookies: string } | null> {
  const fromFetch = await fetchWithFetch(url, headers, timeoutMs);
  if (fromFetch && isUsableHtmlDocument(fromFetch.status, fromFetch.html)) {
    return fromFetch;
  }
  if (process.env.NODE_TEST_CONTEXT) {
    return fromFetch;
  }
  const { curlGetHtml } = await import("./http-curl");
  const fromCurl = await curlGetHtml(url, headers, timeoutMs);
  if (fromCurl && isUsableHtmlDocument(fromCurl.status, fromCurl.html)) {
    return fromCurl;
  }
  return fromFetch ?? fromCurl;
}

async function fetchDirectDocument(url: string): Promise<FetchedDocument | null> {
  const document = await getHtmlDocument(url, BROWSER_NAVIGATE_HEADERS, 15000);
  if (!document || !isUsableHtmlDocument(document.status, document.html)) {
    return null;
  }
  return { html: document.html, cookies: document.cookies, viaReader: false };
}

const READER_HEADERS = {
  Accept: "text/html",
  "User-Agent": "Mozilla/5.0",
  "X-Return-Format": "html",
};

async function fetchSriLankaPageViaReader(): Promise<FetchedDocument> {
  const document = await getHtmlDocument(
    readerUrl(GLOBAL_EXCHANGE_RATES_URL),
    READER_HEADERS,
    20000,
  );
  if (
    !document ||
    !isUsableHtmlDocument(document.status, document.html) ||
    parseGbpLkrRate(document.html) == null
  ) {
    throw new Error(BLOCKED_MESSAGE);
  }
  return { html: document.html, cookies: "", viaReader: true };
}

async function fetchSriLankaPage(): Promise<FetchedDocument> {
  return (
    (await fetchDirectDocument(GLOBAL_EXCHANGE_RATES_URL)) ??
    (await fetchSriLankaPageViaReader())
  );
}

async function fetchGlobalExchangeSession(): Promise<FetchedDocument> {
  return (
    (await fetchDirectDocument(GLOBAL_EXCHANGE_HOME_URL)) ??
    (await fetchSriLankaPage())
  );
}

async function fetchGlobalExchangeCalculate(
  csrfToken: string,
  cookies: string,
): Promise<{ sendRate: number; asOf: string | null }> {
  const response = await fetch(GLOBAL_EXCHANGE_CALCULATE_URL, {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json, text/javascript, */*; q=0.01",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "Accept-Language": "en-GB,en;q=0.9",
      Origin: "https://www.globalexchange.co.uk",
      Referer: GLOBAL_EXCHANGE_HOME_URL,
      "X-CSRF-TOKEN": csrfToken,
      "X-Requested-With": "XMLHttpRequest",
      "User-Agent": USER_AGENT,
      ...(cookies ? { Cookie: cookies } : {}),
    },
    body: new URLSearchParams({
      send_code: "GBP",
      get_code: "LKR",
      quantity: "1000",
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Global Exchange calculator returned ${response.status}`);
  }

  return parseGlobalExchangeCalculate(await response.json());
}

function snapshotFromHtml(html: string): ProviderSnapshot {
  const { sendRate } = parseGlobalExchangeSriLankaPage(html);
  return buildGlobalExchangeSnapshot(sendRate, todayAsOf());
}

export async function fetchGlobalExchangeHtml(): Promise<string> {
  const page = await fetchSriLankaPage();
  return page.html;
}

export async function fetchGlobalExchangeSnapshot(): Promise<ProviderSnapshot> {
  const session = await fetchGlobalExchangeSession();
  const csrfToken = readCsrfToken(session.html);

  if (csrfToken && !session.viaReader) {
    try {
      const quote = await fetchGlobalExchangeCalculate(
        csrfToken,
        session.cookies,
      );
      return buildGlobalExchangeSnapshot(
        quote.sendRate,
        quote.asOf ?? todayAsOf(),
      );
    } catch {
      // Fall through to the published 1 GBP = LKR line.
    }
  }

  try {
    return snapshotFromHtml(session.html);
  } catch (error) {
    if (session.viaReader) {
      throw error;
    }
    const sriLanka = await fetchSriLankaPage();
    return snapshotFromHtml(sriLanka.html);
  }
}
