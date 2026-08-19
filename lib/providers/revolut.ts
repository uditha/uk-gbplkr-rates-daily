import { SEND_AMOUNTS } from "./amounts";
import type { ProviderSnapshot, Quote } from "./types";

export const REVOLUT_RATES_URL = "https://www.revolut.com/en-GB/send-money/";
export const REVOLUT_ROUTES_URL =
  "https://www.revolut.com/api/remittance/routes";
export const REVOLUT_PROVIDER_ID = "revolut-standard";
export const REVOLUT_PROVIDER_NAME = "Revolut (Standard)";

const USER_AGENT =
  "Mozilla/5.0 (compatible; uk-gbplkr-rates/1.0; +https://github.com/uditha/uk-gbplkr-rates-daily)";

const MINOR_UNITS = 100;

export type RevolutMoney = {
  amount: number;
  currency: string;
};

export type RevolutPlanFees = {
  fx: number;
  transfer: number;
  ftt?: number;
  total: number;
  cost?: number;
  currency: string;
};

export type RevolutPlan = {
  id: string;
  name?: string;
  fees: RevolutPlanFees;
  totalSenderAmount?: RevolutMoney;
  senderAmountWithoutFees?: RevolutMoney;
  totalRecipientAmount?: RevolutMoney;
};

export type RevolutRoutesResponse = {
  sender: RevolutMoney;
  recipient: RevolutMoney;
  rate: { from: string; to: string; rate: number; timestamp?: number };
  transferLimits?: {
    lower?: RevolutMoney;
    upper?: RevolutMoney;
  };
  routes: Array<{
    id: string;
    plans: RevolutPlan[];
  }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readNumber(value: unknown, label: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Revolut quote missing ${label}`);
  }
  return parsed;
}

function fromMinor(amount: number): number {
  return amount / MINOR_UNITS;
}

function toMinor(amountGbp: number): number {
  return Math.round(amountGbp * MINOR_UNITS);
}

function parseMoney(value: unknown, label: string): RevolutMoney {
  if (!isRecord(value)) {
    throw new Error(`Revolut quote missing ${label}`);
  }
  return {
    amount: readNumber(value.amount, label),
    currency: typeof value.currency === "string" ? value.currency : "",
  };
}

function parseFees(value: unknown): RevolutPlanFees {
  if (!isRecord(value)) {
    throw new Error("Revolut Standard plan had no fees");
  }
  return {
    fx: readNumber(value.fx, "fx fee"),
    transfer: readNumber(value.transfer, "transfer fee"),
    ftt: value.ftt != null ? readNumber(value.ftt, "ftt fee") : 0,
    total: readNumber(value.total, "total fee"),
    cost: value.cost != null ? readNumber(value.cost, "cost") : undefined,
    currency: typeof value.currency === "string" ? value.currency : "GBP",
  };
}

function parsePlan(value: unknown): RevolutPlan | null {
  if (!isRecord(value) || value.id !== "STANDARD" || !isRecord(value.fees)) {
    return null;
  }
  const plan: RevolutPlan = {
    id: "STANDARD",
    name: typeof value.name === "string" ? value.name : "Standard",
    fees: parseFees(value.fees),
  };
  if (isRecord(value.totalSenderAmount)) {
    plan.totalSenderAmount = parseMoney(value.totalSenderAmount, "sender amount");
  }
  if (isRecord(value.senderAmountWithoutFees)) {
    plan.senderAmountWithoutFees = parseMoney(
      value.senderAmountWithoutFees,
      "amount without fees",
    );
  }
  if (isRecord(value.totalRecipientAmount)) {
    plan.totalRecipientAmount = parseMoney(
      value.totalRecipientAmount,
      "recipient amount",
    );
  }
  return plan;
}

export function parseRevolutRoutesResponse(
  payload: unknown,
): RevolutRoutesResponse {
  if (!isRecord(payload)) {
    throw new Error("Revolut remittance routes was not JSON");
  }

  if (payload.id === "STANDARD") {
    const plan = parsePlan(payload);
    if (!plan?.totalSenderAmount || !plan.totalRecipientAmount) {
      throw new Error("Revolut Standard quote was incomplete");
    }
    const net =
      plan.senderAmountWithoutFees?.amount ??
      plan.totalSenderAmount.amount - plan.fees.total;
    const rate = net > 0 ? plan.totalRecipientAmount.amount / net : 0;
    return {
      sender: plan.totalSenderAmount,
      recipient: plan.totalRecipientAmount,
      rate: { from: "GBP", to: "LKR", rate },
      routes: [{ id: "BANK", plans: [plan] }],
    };
  }

  if (!Array.isArray(payload.routes) || payload.routes.length === 0) {
    throw new Error("Revolut remittance routes had no bank options");
  }

  const sender = parseMoney(payload.sender, "sender amount");
  const recipient = parseMoney(payload.recipient, "recipient amount");
  if (!isRecord(payload.rate)) {
    throw new Error("Revolut remittance routes had no FX rate");
  }

  const routes = payload.routes.map((route, index) => {
    if (!isRecord(route) || typeof route.id !== "string") {
      throw new Error(`Revolut route ${index} was incomplete`);
    }
    const plansRaw = Array.isArray(route.plans) ? route.plans : [];
    return {
      id: route.id,
      plans: plansRaw
        .map((plan) => parsePlan(plan))
        .filter((plan): plan is RevolutPlan => plan != null),
    };
  });

  const limits = isRecord(payload.transferLimits)
    ? {
        lower: isRecord(payload.transferLimits.lower)
          ? parseMoney(payload.transferLimits.lower, "lower limit")
          : undefined,
        upper: isRecord(payload.transferLimits.upper)
          ? parseMoney(payload.transferLimits.upper, "upper limit")
          : undefined,
      }
    : undefined;

  return {
    sender,
    recipient,
    rate: {
      from: typeof payload.rate.from === "string" ? payload.rate.from : "GBP",
      to: typeof payload.rate.to === "string" ? payload.rate.to : "LKR",
      rate: readNumber(payload.rate.rate, "FX rate"),
      timestamp:
        payload.rate.timestamp != null
          ? readNumber(payload.rate.timestamp, "rate timestamp")
          : undefined,
    },
    transferLimits: limits,
    routes,
  };
}

export function selectRevolutStandardPlan(
  response: RevolutRoutesResponse,
): RevolutPlan {
  const bank =
    response.routes.find((route) => route.id === "BANK") ?? response.routes[0];
  const plan = bank?.plans.find((item) => item.id === "STANDARD");
  if (!plan) {
    throw new Error("Revolut had no Standard bank-transfer quote");
  }
  return plan;
}

export function revolutUpperLimitLkr(
  response: RevolutRoutesResponse,
): number | null {
  const upper = response.transferLimits?.upper;
  if (!upper || upper.currency !== "LKR") return null;
  return fromMinor(upper.amount);
}

export function quoteRevolutStandard(
  response: RevolutRoutesResponse,
): Quote | null {
  const plan = selectRevolutStandardPlan(response);
  const amountGbp = fromMinor(response.sender.amount);
  const feeGbp = fromMinor(plan.fees.total);
  const rate = response.rate.rate;

  let netGbp: number;
  let lkrReceived: number;
  let totalPaidGbp: number;

  if (plan.senderAmountWithoutFees && plan.totalRecipientAmount) {
    netGbp = fromMinor(plan.senderAmountWithoutFees.amount);
    lkrReceived = fromMinor(plan.totalRecipientAmount.amount);
    totalPaidGbp = amountGbp;
  } else {
    netGbp = amountGbp;
    lkrReceived = fromMinor(response.recipient.amount);
    totalPaidGbp = amountGbp + feeGbp;
  }

  const upperLkr = revolutUpperLimitLkr(response);
  if (upperLkr != null && lkrReceived > upperLkr) {
    return null;
  }

  const effectiveRate = lkrReceived / totalPaidGbp;

  return {
    amountGbp,
    feeGbp,
    netGbp,
    lkrReceived,
    effectiveRate,
    behindBoardRate: rate - effectiveRate,
  };
}

export function formatRevolutAsOf(timestamp: number | undefined): string | null {
  if (timestamp == null) return null;
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-GB");
}

export function buildRevolutSnapshot(
  quotes: (Quote | null)[],
  boardRate: number,
  asOf: string | null,
): ProviderSnapshot {
  return {
    id: REVOLUT_PROVIDER_ID,
    name: REVOLUT_PROVIDER_NAME,
    sourceUrl: REVOLUT_RATES_URL,
    pair: "GBPLKR",
    boardRate,
    rateKind: "send",
    asOf,
    quotes,
  };
}

export async function fetchRevolutRoutes(
  amountGbp: number,
): Promise<RevolutRoutesResponse> {
  const url = new URL(REVOLUT_ROUTES_URL);
  url.searchParams.set("amount", String(toMinor(amountGbp)));
  url.searchParams.set("isRecipientAmount", "false");
  url.searchParams.set("recipientCountry", "LK");
  url.searchParams.set("recipientCurrency", "LKR");
  url.searchParams.set("senderCountry", "GB");
  url.searchParams.set("senderCurrency", "GBP");

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Accept-Language": "en-GB",
      Origin: "https://www.revolut.com",
      Referer: REVOLUT_RATES_URL,
      "User-Agent": USER_AGENT,
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Revolut remittance routes returned ${response.status}`);
  }

  return parseRevolutRoutesResponse(await response.json());
}

export async function fetchRevolutSnapshot(): Promise<ProviderSnapshot> {
  const first = await fetchRevolutRoutes(SEND_AMOUNTS[0].amountGbp);
  const upperLkr = revolutUpperLimitLkr(first);
  const rest = await Promise.all(
    SEND_AMOUNTS.slice(1).map(async (column) => {
      if (upperLkr != null && column.amountGbp * first.rate.rate > upperLkr) {
        return null;
      }
      return fetchRevolutRoutes(column.amountGbp);
    }),
  );

  const quotes = [first, ...rest].map((response) =>
    response ? quoteRevolutStandard(response) : null,
  );

  return buildRevolutSnapshot(
    quotes,
    first.rate.rate,
    formatRevolutAsOf(first.rate.timestamp),
  );
}
