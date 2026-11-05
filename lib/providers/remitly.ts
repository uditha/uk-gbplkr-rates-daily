import { randomUUID } from "node:crypto";
import { SEND_AMOUNTS } from "./amounts";
import { BROWSER_USER_AGENT } from "./http";
import type { ProviderSnapshot, Quote } from "./types";

export const REMITLY_RATES_URL = "https://www.remitly.com/gb/en/sri-lanka";
export const REMITLY_ESTIMATE_URL =
  "https://api.remitly.io/v3/calculator/estimate";
export const REMITLY_PROVIDER_ID = "remitly-standard";
export const REMITLY_PROVIDER_NAME = "Remitly (standard)";

const USER_AGENT = BROWSER_USER_AGENT;
const REMITLY_DEVICE_ID = randomUUID();
const REMITLY_MIN_INTERVAL_MS = 1200;
let nextRemitlyRequestAt = 0;

async function waitForRemitlySlot(): Promise<void> {
  const now = Date.now();
  const delay = Math.max(0, nextRemitlyRequestAt - now);
  nextRemitlyRequestAt =
    Math.max(now, nextRemitlyRequestAt) + REMITLY_MIN_INTERVAL_MS;
  if (delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

export type RemitlyEstimate = {
  sendAmount: number;
  receiveAmount: number;
  totalChargeAmount: number;
  totalFeeAmount: number;
  feeDiscountAmount: number;
  sendDiscountAmount: number;
  feeIsFlat: boolean;
  baseRate: number;
  promotionalRate: number | null;
  promotionalCapGbp: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readNumber(value: unknown, label: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Remitly estimate missing ${label}`);
  }
  return parsed;
}

function roundGbp(value: number): number {
  return Number(value.toFixed(2));
}

export function remitlyNetFeeGbp(estimate: RemitlyEstimate): number {
  return Math.max(
    0,
    roundGbp(estimate.totalFeeAmount - estimate.feeDiscountAmount),
  );
}

export function remitlyTotalPaidGbp(
  amountGbp: number,
  estimate: RemitlyEstimate,
): number {
  return Math.max(
    0,
    roundGbp(
      amountGbp + remitlyNetFeeGbp(estimate) - estimate.sendDiscountAmount,
    ),
  );
}

export function remitlyReceiveLkr(
  amountGbp: number,
  estimate: RemitlyEstimate,
): number {
  return Number((amountGbp * estimate.baseRate).toFixed(2));
}

export function parseRemitlyEstimate(payload: unknown): RemitlyEstimate {
  if (!isRecord(payload) || !isRecord(payload.estimate)) {
    throw new Error("Remitly estimate was not JSON");
  }
  const estimate = payload.estimate;
  const conduit = isRecord(estimate.conduit) ? estimate.conduit : {};
  const source = isRecord(conduit.source_currency) ? conduit.source_currency : {};
  const target = isRecord(conduit.target_currency) ? conduit.target_currency : {};
  if (source.alpha3 !== "GBP" || target.alpha3 !== "LKR") {
    throw new Error(
      `Remitly estimate was ${String(source.alpha3)}/${String(target.alpha3)}, not GBP/LKR`,
    );
  }

  const fee = isRecord(estimate.fee) ? estimate.fee : {};
  const discount = isRecord(estimate.discount) ? estimate.discount : {};
  const fx = isRecord(estimate.exchange_rate) ? estimate.exchange_rate : {};

  const promotionalRate =
    fx.promotional_exchange_rate != null && fx.promotional_exchange_rate !== ""
      ? readNumber(fx.promotional_exchange_rate, "promotional rate")
      : null;
  const promotionalCapGbp =
    fx.capped_promotional_exchange_rate_amount != null &&
    fx.capped_promotional_exchange_rate_amount !== ""
      ? readNumber(
          fx.capped_promotional_exchange_rate_amount,
          "promotional cap",
        )
      : null;

  return {
    sendAmount: readNumber(estimate.send_amount, "send amount"),
    receiveAmount: readNumber(estimate.receive_amount, "receive amount"),
    totalChargeAmount: readNumber(estimate.total_charge_amount, "total charge"),
    totalFeeAmount: readNumber(fee.total_fee_amount, "fee"),
    feeIsFlat: fee.is_flat !== false,
    feeDiscountAmount:
      discount.fee_discount_amount != null
        ? readNumber(discount.fee_discount_amount, "fee discount")
        : 0,
    sendDiscountAmount:
      discount.send_discount_amount != null
        ? readNumber(discount.send_discount_amount, "send discount")
        : 0,
    baseRate: readNumber(fx.base_rate, "base rate"),
    promotionalRate,
    promotionalCapGbp,
  };
}

export function quoteRemitlyAmount(
  amountGbp: number,
  estimate: RemitlyEstimate,
): Quote {
  const feeGbp = remitlyNetFeeGbp(estimate);
  const netGbp = amountGbp;
  const lkrReceived = remitlyReceiveLkr(amountGbp, estimate);
  const totalPaidGbp = remitlyTotalPaidGbp(amountGbp, estimate);
  const boardRate = estimate.baseRate;
  const effectiveRate = lkrReceived / totalPaidGbp;

  return {
    amountGbp,
    feeGbp,
    netGbp,
    lkrReceived,
    effectiveRate,
    behindBoardRate: boardRate - effectiveRate,
  };
}

export function sameRemitlyPricing(
  left: RemitlyEstimate,
  right: RemitlyEstimate,
): boolean {
  if (!left.feeIsFlat || !right.feeIsFlat) return false;
  return (
    Math.abs(left.baseRate - right.baseRate) < 0.000001 &&
    Math.abs(remitlyNetFeeGbp(left) - remitlyNetFeeGbp(right)) < 0.001 &&
    Math.abs(left.sendDiscountAmount - right.sendDiscountAmount) < 0.001
  );
}

export function estimateAtAmount(
  template: RemitlyEstimate,
  amountGbp: number,
): RemitlyEstimate {
  if (template.sendAmount === amountGbp) return template;
  return {
    ...template,
    sendAmount: amountGbp,
    receiveAmount: remitlyReceiveLkr(amountGbp, template),
    totalChargeAmount: remitlyTotalPaidGbp(amountGbp, template),
  };
}

export async function collectTieredRemitlyEstimates(
  amounts: number[],
  fetchEstimate: (amountGbp: number) => Promise<RemitlyEstimate>,
): Promise<RemitlyEstimate[]> {
  const byIndex = new Map<number, RemitlyEstimate>();

  async function load(index: number): Promise<RemitlyEstimate> {
    const existing = byIndex.get(index);
    if (existing) return existing;
    const estimate = await fetchEstimate(amounts[index]);
    byIndex.set(index, estimate);
    return estimate;
  }

  async function fill(lo: number, hi: number): Promise<void> {
    const left = await load(lo);
    const right = await load(hi);
    if (hi - lo <= 1 || sameRemitlyPricing(left, right)) return;
    const mid = Math.floor((lo + hi) / 2);
    await fill(lo, mid);
    await fill(mid, hi);
  }

  if (amounts.length === 0) return [];
  await fill(0, amounts.length - 1);

  return amounts.map((amount, index) => {
    const direct = byIndex.get(index);
    if (direct) return direct;
    let left = index - 1;
    while (!byIndex.has(left)) left -= 1;
    return estimateAtAmount(byIndex.get(left) as RemitlyEstimate, amount);
  });
}

export function buildRemitlyColumnSnapshot(
  estimates: RemitlyEstimate[],
  asOf: string | null = null,
): ProviderSnapshot {
  if (estimates.length !== SEND_AMOUNTS.length) {
    throw new Error("Remitly quotes did not cover every send amount");
  }
  const board = estimates[0];
  return {
    id: REMITLY_PROVIDER_ID,
    name: REMITLY_PROVIDER_NAME,
    sourceUrl: REMITLY_RATES_URL,
    pair: "GBPLKR",
    boardRate: board.baseRate,
    rateKind: "send",
    asOf,
    quotes: SEND_AMOUNTS.map((column, index) =>
      quoteRemitlyAmount(column.amountGbp, estimates[index]),
    ),
  };
}

export function buildRemitlySnapshot(
  estimate: RemitlyEstimate,
  asOf: string | null = null,
): ProviderSnapshot {
  return {
    id: REMITLY_PROVIDER_ID,
    name: REMITLY_PROVIDER_NAME,
    sourceUrl: REMITLY_RATES_URL,
    pair: "GBPLKR",
    boardRate: estimate.baseRate,
    rateKind: "send",
    asOf,
    quotes: SEND_AMOUNTS.map((column) =>
      quoteRemitlyAmount(column.amountGbp, estimate),
    ),
  };
}

async function fetchRemitlyEstimateOnce(amountGbp: number): Promise<Response> {
  const url = new URL(REMITLY_ESTIMATE_URL);
  url.searchParams.set("conduit", "GBR:GBP-LKA:LKR");
  url.searchParams.set("anchor", "SEND");
  url.searchParams.set("amount", String(amountGbp));
  url.searchParams.set("purpose", "OTHER");
  url.searchParams.set("customer_segment", "STANDARD");
  url.searchParams.set("customer_recognition", "UNRECOGNIZED");
  url.searchParams.set("strict_promo", "true");

  await waitForRemitlySlot();
  return fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Accept-Language": "en-GB",
      Origin: "https://www.remitly.com",
      Referer: REMITLY_RATES_URL,
      "Remitly-DeviceEnvironmentID": REMITLY_DEVICE_ID,
      "remittance-distro-id": "app_id_core",
      "User-Agent": USER_AGENT,
    },
    signal: AbortSignal.timeout(15000),
  });
}

export async function fetchRemitlyEstimate(
  amountGbp = 300,
): Promise<RemitlyEstimate> {
  let lastError = "Remitly estimate failed";
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await fetchRemitlyEstimateOnce(amountGbp);
    if (response.status === 429) {
      lastError = "Remitly estimate returned 429";
      await new Promise((resolve) =>
        setTimeout(resolve, 1500 * (attempt + 1)),
      );
      continue;
    }
    if (!response.ok) {
      throw new Error(`Remitly estimate returned ${response.status}`);
    }
    const estimate = parseRemitlyEstimate(await response.json());
    const expectedReceive = remitlyReceiveLkr(estimate.sendAmount, estimate);
    if (Math.abs(expectedReceive - estimate.receiveAmount) > 0.05) {
      throw new Error(
        `Remitly receive amount ${estimate.receiveAmount} did not match standard-rate formula ${expectedReceive}`,
      );
    }
    const expectedCharge = remitlyTotalPaidGbp(
      estimate.sendAmount,
      estimate,
    );
    if (Math.abs(expectedCharge - estimate.totalChargeAmount) > 0.05) {
      throw new Error(
        `Remitly total charge ${estimate.totalChargeAmount} did not match send plus net fee ${expectedCharge}`,
      );
    }
    return estimate;
  }
  throw new Error(lastError);
}

export async function fetchRemitlySnapshot(): Promise<ProviderSnapshot> {
  const estimates = await collectTieredRemitlyEstimates(
    SEND_AMOUNTS.map((column) => column.amountGbp),
    (amountGbp) => fetchRemitlyEstimate(amountGbp),
  );
  const asOf = new Date().toLocaleDateString("en-GB");
  return buildRemitlyColumnSnapshot(estimates, asOf);
}
