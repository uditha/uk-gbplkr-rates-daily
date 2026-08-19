import { SEND_AMOUNTS } from "./amounts";
import type { ProviderSnapshot, Quote } from "./types";

export const WISE_RATES_URL = "https://wise.com/gb/";
export const WISE_QUOTES_URL = "https://wise.com/gateway/v3/quotes";
export const WISE_PROVIDER_ID = "wise";
export const WISE_PROVIDER_NAME = "Wise";

const USER_AGENT =
  "Mozilla/5.0 (compatible; uk-gbplkr-rates/1.0; +https://github.com/uditha/uk-gbplkr-rates-daily)";

const PREFERRED_PAY_INS = ["PISP", "BANK_TRANSFER"] as const;

export type WisePaymentOption = {
  payIn: string;
  payOut?: string;
  disabled?: boolean;
  sourceAmount: number;
  targetAmount: number;
  fee: { total: number };
};

export type WiseQuoteResponse = {
  rate: number;
  rateTimestamp?: string;
  sourceCurrency: string;
  targetCurrency: string;
  sourceAmount: number;
  paymentOptions: WisePaymentOption[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readNumber(value: unknown, label: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Wise quote missing ${label}`);
  }
  return parsed;
}

export function parseWiseQuoteResponse(payload: unknown): WiseQuoteResponse {
  if (!isRecord(payload)) {
    throw new Error("Wise quote was not JSON");
  }

  const paymentOptionsRaw = payload.paymentOptions;
  if (!Array.isArray(paymentOptionsRaw) || paymentOptionsRaw.length === 0) {
    throw new Error("Wise quote had no payment options");
  }

  const paymentOptions = paymentOptionsRaw.map((option, index) => {
    if (!isRecord(option) || !isRecord(option.fee)) {
      throw new Error(`Wise payment option ${index} was incomplete`);
    }
    if (typeof option.payIn !== "string") {
      throw new Error(`Wise payment option ${index} had no pay-in method`);
    }
    return {
      payIn: option.payIn,
      payOut: typeof option.payOut === "string" ? option.payOut : undefined,
      disabled: Boolean(option.disabled),
      sourceAmount: readNumber(option.sourceAmount, `option ${index} source amount`),
      targetAmount: readNumber(option.targetAmount, `option ${index} target amount`),
      fee: { total: readNumber(option.fee.total, `option ${index} fee`) },
    };
  });

  const sourceCurrency =
    typeof payload.sourceCurrency === "string" ? payload.sourceCurrency : "";
  const targetCurrency =
    typeof payload.targetCurrency === "string" ? payload.targetCurrency : "";
  if (sourceCurrency !== "GBP" || targetCurrency !== "LKR") {
    throw new Error(
      `Wise quote was ${sourceCurrency || "?"}/${targetCurrency || "?"}, not GBP/LKR`,
    );
  }

  return {
    rate: readNumber(payload.rate, "mid-market rate"),
    rateTimestamp:
      typeof payload.rateTimestamp === "string" ? payload.rateTimestamp : undefined,
    sourceCurrency,
    targetCurrency,
    sourceAmount: readNumber(payload.sourceAmount, "source amount"),
    paymentOptions,
  };
}

export function selectWisePayInOption(
  options: WisePaymentOption[],
): WisePaymentOption {
  const bankOut = options.filter(
    (option) => (option.payOut ?? "BANK_TRANSFER") === "BANK_TRANSFER",
  );
  const pool = bankOut.length > 0 ? bankOut : options;

  for (const payIn of PREFERRED_PAY_INS) {
    const enabled = pool.find((option) => option.payIn === payIn && !option.disabled);
    if (enabled) return enabled;
  }
  for (const payIn of PREFERRED_PAY_INS) {
    const any = pool.find((option) => option.payIn === payIn);
    if (any) return any;
  }

  throw new Error("Wise quote had no UK bank pay-in option");
}

export function quoteFromWiseResponse(response: WiseQuoteResponse): Quote {
  const option = selectWisePayInOption(response.paymentOptions);
  const amountGbp = option.sourceAmount;
  const feeGbp = option.fee.total;
  const netGbp = amountGbp - feeGbp;
  const lkrReceived = option.targetAmount;
  const effectiveRate = lkrReceived / amountGbp;

  return {
    amountGbp,
    feeGbp,
    netGbp,
    lkrReceived,
    effectiveRate,
    behindBoardRate: response.rate - effectiveRate,
  };
}

export function formatWiseAsOf(rateTimestamp: string | undefined): string | null {
  if (!rateTimestamp) return null;
  const parsed = new Date(rateTimestamp);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-GB");
}

export function buildWiseSnapshot(
  quotes: Quote[],
  boardRate: number,
  asOf: string | null,
): ProviderSnapshot {
  return {
    id: WISE_PROVIDER_ID,
    name: WISE_PROVIDER_NAME,
    sourceUrl: WISE_RATES_URL,
    pair: "GBPLKR",
    boardRate,
    rateKind: "send",
    asOf,
    quotes,
  };
}

export async function fetchWiseQuote(
  amountGbp: number,
): Promise<WiseQuoteResponse> {
  const response = await fetch(WISE_QUOTES_URL, {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Origin: "https://wise.com",
      Referer: WISE_RATES_URL,
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify({
      sourceAmount: amountGbp,
      sourceCurrency: "GBP",
      targetCurrency: "LKR",
      preferredPayIn: "PISP",
      guaranteedTargetAmount: false,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Wise quotes API returned ${response.status}`);
  }

  return parseWiseQuoteResponse(await response.json());
}

export async function fetchWiseSnapshot(): Promise<ProviderSnapshot> {
  const responses = await Promise.all(
    SEND_AMOUNTS.map((column) => fetchWiseQuote(column.amountGbp)),
  );
  const first = responses[0];
  if (!first) {
    throw new Error("Wise returned no quotes");
  }

  return buildWiseSnapshot(
    responses.map(quoteFromWiseResponse),
    first.rate,
    formatWiseAsOf(first.rateTimestamp),
  );
}
