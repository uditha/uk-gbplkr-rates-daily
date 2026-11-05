import { SEND_AMOUNTS } from "./amounts";
import { BROWSER_USER_AGENT } from "./http";
import type { ProviderSnapshot, Quote } from "./types";

export const BOC_UK_RATES_URL = "https://bankofceylon.co.uk/rates/";
export const BOC_UK_RATES_API_URL =
  "https://bankofceylon.co.uk/wp-json/erc/v1/rates";
export const BOC_UK_PROVIDER_ID = "remitwire-boc-uk";
export const BOC_UK_PROVIDER_NAME = "RemitWire (BOC UK)";

const USER_AGENT = BROWSER_USER_AGENT;

export type BocUkFeeSlab = {
  min: number;
  max: number | null;
  type: "fixed" | "percent";
  value: number;
};

export type BocUkFeeMode = "add" | "deduct";

export type BocUkRateCard = {
  buyingRate: number;
  sellingRate: number | null;
  asOf: string | null;
  feeMode: BocUkFeeMode;
  receiveDecimals: number;
  slabs: BocUkFeeSlab[];
};

export const BOC_UK_DEFAULT_SLABS: BocUkFeeSlab[] = [
  { min: 0, max: 1000, type: "fixed", value: 3 },
  { min: 1000, max: 5000, type: "fixed", value: 5 },
  { min: 5000, max: 20000, type: "fixed", value: 10 },
  { min: 20000, max: 50000, type: "fixed", value: 20 },
  { min: 50000, max: 100000, type: "fixed", value: 25 },
  { min: 100000, max: null, type: "fixed", value: 30 },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseNumber(value: string): number {
  const parsed = Number(value.replace(/,/g, "").trim());
  if (!Number.isFinite(parsed)) {
    throw new Error(`Could not parse number: ${value}`);
  }
  return parsed;
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function asOfDate(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.match(/(\d{1,2}\/\d{1,2}\/\d{4})/)?.[1] ?? null;
}

export function feeForSlabs(amountGbp: number, slabs: BocUkFeeSlab[]): number {
  if (amountGbp <= 0) {
    throw new Error("Send amount must be positive");
  }
  const slab = slabs.find(
    (item) =>
      amountGbp >= item.min && (item.max == null || amountGbp <= item.max),
  );
  if (!slab) return 0;
  const fee =
    slab.type === "percent" ? (amountGbp * slab.value) / 100 : slab.value;
  return roundTo(fee, 2);
}

export function bocUkFeeGbp(
  amountGbp: number,
  slabs: BocUkFeeSlab[] = BOC_UK_DEFAULT_SLABS,
): number {
  return feeForSlabs(amountGbp, slabs);
}

export function parseBocUkRatesPage(html: string): {
  buyingRate: number;
  sellingRate: number;
  asOf: string | null;
} {
  const gbpLkrRow = html.match(
    /GBP\s*\/(?:\s|<[^>]*>)*LKR[\s\S]{0,500}?<td[^>]*>\s*([\d.,]+)\s*<\/td>\s*<td[^>]*>\s*([\d.,]+)\s*<\/td>/i,
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

function readSlab(value: unknown, index: number): BocUkFeeSlab {
  if (!isRecord(value)) {
    throw new Error(`BOC UK fee band ${index + 1} was incomplete`);
  }
  const min = Number(value.min);
  const max =
    value.max == null || value.max === "" ? null : Number(value.max);
  const fee = Number(value.value);
  if (!Number.isFinite(min) || !Number.isFinite(fee)) {
    throw new Error(`BOC UK fee band ${index + 1} was incomplete`);
  }
  if (max != null && !Number.isFinite(max)) {
    throw new Error(`BOC UK fee band ${index + 1} was incomplete`);
  }
  return {
    min,
    max,
    type: value.type === "percent" ? "percent" : "fixed",
    value: fee,
  };
}

export function parseBocUkRatesPayload(payload: unknown): BocUkRateCard {
  if (!isRecord(payload) || !Array.isArray(payload.pairs)) {
    throw new Error("BOC UK rates feed was not JSON");
  }
  const pair = payload.pairs.find(
    (item) => isRecord(item) && item.key === "GBP_LKR",
  );
  if (!isRecord(pair)) {
    throw new Error("BOC UK rates feed had no GBP/LKR pair");
  }

  const buyingRate = Number(pair.rate);
  if (!Number.isFinite(buyingRate) || buyingRate <= 0) {
    throw new Error("BOC UK rates feed had no GBP/LKR buying rate");
  }

  const values = Array.isArray(pair.values) ? pair.values : [];
  const sellingRaw = values[1];
  const sellingRate =
    typeof sellingRaw === "string" || typeof sellingRaw === "number"
      ? Number(String(sellingRaw).replace(/,/g, ""))
      : null;

  const slabs = Array.isArray(pair.slabs)
    ? pair.slabs.map((slab, index) => readSlab(slab, index))
    : [];
  const decimals = Number(payload.receiveDecimals);

  return {
    buyingRate,
    sellingRate: Number.isFinite(sellingRate) ? sellingRate : null,
    asOf: asOfDate(typeof payload.as_of === "string" ? payload.as_of : null),
    feeMode: payload.fee_mode === "deduct" ? "deduct" : "add",
    receiveDecimals:
      Number.isFinite(decimals) && decimals >= 0 && decimals <= 4
        ? Math.floor(decimals)
        : 2,
    slabs: slabs.length > 0 ? slabs : BOC_UK_DEFAULT_SLABS,
  };
}

export function quoteForAmount(
  amountGbp: number,
  buyingRate: number,
  options: {
    slabs?: BocUkFeeSlab[];
    feeMode?: BocUkFeeMode;
    receiveDecimals?: number;
  } = {},
): Quote {
  const slabs = options.slabs ?? BOC_UK_DEFAULT_SLABS;
  const feeMode = options.feeMode ?? "add";
  const receiveDecimals = options.receiveDecimals ?? 2;
  const feeGbp = feeForSlabs(amountGbp, slabs);
  const netGbp =
    feeMode === "deduct" ? Math.max(0, amountGbp - feeGbp) : amountGbp;
  const lkrReceived = roundTo(netGbp * buyingRate, receiveDecimals);
  const totalPaidGbp = feeMode === "add" ? amountGbp + feeGbp : amountGbp;
  const effectiveRate = lkrReceived / totalPaidGbp;

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
  options: {
    slabs?: BocUkFeeSlab[];
    feeMode?: BocUkFeeMode;
    receiveDecimals?: number;
  } = {},
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
      quoteForAmount(column.amountGbp, buyingRate, options),
    ),
  };
}

export function snapshotFromBocUkRateCard(card: BocUkRateCard): ProviderSnapshot {
  return buildBocUkSnapshot(card.buyingRate, card.asOf, {
    slabs: card.slabs,
    feeMode: card.feeMode,
    receiveDecimals: card.receiveDecimals,
  });
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

export async function fetchBocUkRatesPayload(): Promise<unknown> {
  const url = new URL(BOC_UK_RATES_API_URL);
  url.searchParams.set("_erc", String(Date.now()));
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`BOC UK rates feed returned ${response.status}`);
  }

  return response.json();
}

export async function fetchBocUkSnapshot(): Promise<ProviderSnapshot> {
  try {
    const card = parseBocUkRatesPayload(await fetchBocUkRatesPayload());
    return snapshotFromBocUkRateCard(card);
  } catch (apiError) {
    try {
      const html = await fetchBocUkHtml();
      const page = parseBocUkRatesPage(html);
      return buildBocUkSnapshot(page.buyingRate, page.asOf, { feeMode: "add" });
    } catch (pageError) {
      const apiMessage =
        apiError instanceof Error ? apiError.message : "BOC UK rates feed failed";
      const pageMessage =
        pageError instanceof Error ? pageError.message : "BOC UK rates page failed";
      throw new Error(`${apiMessage}. ${pageMessage}`);
    }
  }
}
