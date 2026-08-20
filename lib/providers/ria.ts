import { SEND_AMOUNTS } from "./amounts";
import { BROWSER_USER_AGENT } from "./http";
import type { ProviderSnapshot, Quote } from "./types";

export const RIA_RATES_URL = "https://www.riamoneytransfer.com/en-gb";
export const RIA_SESSION_URL =
  "https://public.riamoneytransfer.com/public/authorization/session";
export const RIA_CALCULATE_URL =
  "https://public.riamoneytransfer.com/MoneyTransferCalculator/Calculate";
export const RIA_PROVIDER_ID = "ria-money-transfer";
export const RIA_PROVIDER_NAME = "Ria Money Transfer";

const USER_AGENT = BROWSER_USER_AGENT;

export type RiaEstimate = {
  sendAmount: number;
  receiveAmount: number;
  totalChargeAmount: number;
  transferFee: number;
  exchangeRate: number;
  promotionalRate: number | null;
  minSendGbp: number;
  maxSendGbp: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readNumber(value: unknown, label: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Ria calculator missing ${label}`);
  }
  return parsed;
}

function transferDetails(payload: Record<string, unknown>): Record<string, unknown> {
  const model = isRecord(payload.model) ? payload.model : payload;
  if (isRecord(model.transferDetails)) {
    return model.transferDetails;
  }
  return model;
}

export function parseRiaEstimate(payload: unknown): RiaEstimate {
  if (!isRecord(payload)) {
    throw new Error("Ria calculator was not JSON");
  }
  if (payload.action === "ForceUpdate") {
    throw new Error("Ria calculator returned ForceUpdate");
  }
  if (!isRecord(payload.model) && payload.action) {
    throw new Error(`Ria calculator returned ${String(payload.action)}`);
  }

  const details = transferDetails(payload);
  const selections = isRecord(details.selections) ? details.selections : {};
  const calculations = isRecord(details.calculations) ? details.calculations : {};
  if (Object.keys(calculations).length === 0) {
    throw new Error("Ria calculator had no quote");
  }

  const currencyFrom = String(selections.currencyFrom ?? "");
  const currencyTo = String(selections.currencyTo ?? "");
  if (currencyFrom && currencyTo && (currencyFrom !== "GBP" || currencyTo !== "LKR")) {
    throw new Error(
      `Ria calculator was ${currencyFrom}/${currencyTo}, not GBP/LKR`,
    );
  }

  const limits = isRecord(calculations.sendAmountLimit)
    ? calculations.sendAmountLimit
    : {};
  const promotionalRate =
    calculations.exchangeRatePromo != null && calculations.exchangeRatePromo !== ""
      ? readNumber(calculations.exchangeRatePromo, "promotional rate")
      : null;

  return {
    sendAmount: readNumber(
      calculations.amountFrom ?? selections.amountFrom,
      "send amount",
    ),
    receiveAmount: readNumber(calculations.amountTo, "receive amount"),
    totalChargeAmount: readNumber(
      calculations.totalAmount ?? calculations.amountFrom,
      "total amount",
    ),
    transferFee:
      calculations.transferFee != null && calculations.transferFee !== ""
        ? readNumber(calculations.transferFee, "fee")
        : 0,
    exchangeRate: readNumber(calculations.exchangeRate, "exchange rate"),
    promotionalRate,
    minSendGbp:
      limits.minimumSendFromAmount != null
        ? readNumber(limits.minimumSendFromAmount, "minimum send")
        : 0,
    maxSendGbp:
      limits.maximumSendFromAmount != null
        ? readNumber(limits.maximumSendFromAmount, "maximum send")
        : Number.POSITIVE_INFINITY,
  };
}

export function riaReceiveLkr(amountGbp: number, estimate: RiaEstimate): number {
  return Number((amountGbp * estimate.exchangeRate).toFixed(2));
}

export function riaTotalPaidGbp(amountGbp: number, estimate: RiaEstimate): number {
  return amountGbp + estimate.transferFee;
}

export function quoteRiaAmount(
  amountGbp: number,
  estimate: RiaEstimate,
): Quote | null {
  if (amountGbp < estimate.minSendGbp || amountGbp > estimate.maxSendGbp) {
    return null;
  }

  const feeGbp = estimate.transferFee;
  const netGbp = amountGbp;
  const lkrReceived = riaReceiveLkr(amountGbp, estimate);
  const totalPaidGbp = riaTotalPaidGbp(amountGbp, estimate);
  const effectiveRate = lkrReceived / totalPaidGbp;

  return {
    amountGbp,
    feeGbp,
    netGbp,
    lkrReceived,
    effectiveRate,
    behindBoardRate: estimate.exchangeRate - effectiveRate,
  };
}

export function buildRiaSnapshot(
  estimate: RiaEstimate,
  asOf: string | null = null,
): ProviderSnapshot {
  return {
    id: RIA_PROVIDER_ID,
    name: RIA_PROVIDER_NAME,
    sourceUrl: RIA_RATES_URL,
    pair: "GBPLKR",
    boardRate: estimate.exchangeRate,
    rateKind: "send",
    asOf,
    quotes: SEND_AMOUNTS.map((column) =>
      quoteRiaAmount(column.amountGbp, estimate),
    ),
  };
}

async function fetchRiaSessionToken(): Promise<string> {
  const response = await fetch(RIA_SESSION_URL, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      CultureCode: "en-GB",
      IsoCode: "GB",
      Origin: "https://www.riamoneytransfer.com",
      Referer: RIA_RATES_URL,
      "User-Agent": USER_AGENT,
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new Error(`Ria session returned ${response.status}`);
  }
  const payload: unknown = await response.json();
  if (!isRecord(payload) || !isRecord(payload.authToken)) {
    throw new Error("Ria session had no token");
  }
  const token = payload.authToken.jwtToken;
  if (typeof token !== "string" || !token) {
    throw new Error("Ria session had no token");
  }
  return token;
}

async function fetchRiaCalculateOnce(
  token: string,
  amountGbp: number,
): Promise<Response> {
  return fetch(RIA_CALCULATE_URL, {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Culturecode: "en-GB",
      Appversion: "4.0",
      "Client-Type": "PublicSite",
      Origin: "https://www.riamoneytransfer.com",
      Referer: RIA_RATES_URL,
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify({
      selections: {
        countryFrom: "UK",
        countryTo: "LK",
        amountFrom: amountGbp,
        currencyTo: "LKR",
        currencyFrom: "GBP",
        paymentMethod: "BankAccount",
        deliveryMethod: "BankDeposit",
        promoId: 0,
        shouldCalcAmountFrom: false,
        shouldCalcVariableRates: true,
      },
    }),
    signal: AbortSignal.timeout(15000),
  });
}

export async function fetchRiaEstimate(amountGbp = 300): Promise<RiaEstimate> {
  const token = await fetchRiaSessionToken();
  let lastError = "Ria calculator failed";
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetchRiaCalculateOnce(token, amountGbp);
    if (response.status === 429 || response.status >= 500) {
      lastError = `Ria calculator returned ${response.status}`;
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 * (attempt + 1)),
      );
      continue;
    }
    if (!response.ok) {
      throw new Error(`Ria calculator returned ${response.status}`);
    }
    return parseRiaEstimate(await response.json());
  }
  throw new Error(lastError);
}

export async function fetchRiaSnapshot(): Promise<ProviderSnapshot> {
  const estimate = await fetchRiaEstimate(300);
  const asOf = new Date().toLocaleDateString("en-GB");
  return buildRiaSnapshot(estimate, asOf);
}
