import { SEND_AMOUNTS } from "./amounts";
import type { ProviderSnapshot, Quote } from "./types";

export const WU_RATES_URL =
  "https://www.westernunion.com/gb/en/web/send-money/start";
export const WU_CATALOG_URL =
  "https://www.westernunion.com/wuconnect/prices/catalog";

export const WU_BANK_PROVIDER_ID = "western-union-bank";
export const WU_BANK_PROVIDER_NAME = "Western Union (bank)";
export const WU_CASH_PROVIDER_ID = "wu-cash-pickup-sl";
export const WU_CASH_PROVIDER_NAME = "WU (cash pickup SL)";

export const WU_BANK_SERVICE = "500";
export const WU_CASH_SERVICE = "000";

const USER_AGENT =
  "Mozilla/5.0 (compatible; uk-gbplkr-rates/1.0; +https://github.com/uditha/uk-gbplkr-rates-daily)";

const PREFERRED_FUNDS_IN = ["PA", "EB", "TR"] as const;
const CATALOG_CACHE_MS = 90_000;

export type WuPayGroup = {
  fundsIn: string;
  fxRate: number;
  sendAmount: number;
  receiveAmount: number;
  grossAmount: number;
  grossFee: number;
  minAmount: number;
  maxAmount: number;
};

export type WuServiceGroup = {
  service: string;
  serviceName: string;
  payGroups: WuPayGroup[];
};

export type WuCatalog = {
  sendAmount: number;
  services: WuServiceGroup[];
};

type WuPayout = "bank" | "cash";

type CatalogCache = {
  expiresAt: number;
  catalogs: Map<number, WuCatalog>;
};

let catalogCache: CatalogCache | null = null;
let catalogInflight: Promise<Map<number, WuCatalog>> | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readNumber(value: unknown, label: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Western Union catalog missing ${label}`);
  }
  return parsed;
}

function readString(value: unknown): string {
  return value == null ? "" : String(value);
}

export function parseWuCatalog(payload: unknown): WuCatalog {
  if (!isRecord(payload)) {
    throw new Error("Western Union catalog was not JSON");
  }

  const status = isRecord(payload.response_status)
    ? payload.response_status
    : {};
  const code = readString(status.code);
  if (code && code !== "P0000") {
    throw new Error(
      `Western Union catalog returned ${code}: ${readString(status.message) || "error"}`,
    );
  }

  const sender = isRecord(payload.sender) ? payload.sender : {};
  const receiver = isRecord(payload.receiver) ? payload.receiver : {};
  if (readString(sender.curr_iso3) !== "GBP" || readString(receiver.curr_iso3) !== "LKR") {
    throw new Error(
      `Western Union catalog was ${readString(sender.curr_iso3) || "?"}/${readString(receiver.curr_iso3) || "?"}, not GBP/LKR`,
    );
  }

  const groupsRaw = payload.services_groups;
  if (!Array.isArray(groupsRaw) || groupsRaw.length === 0) {
    throw new Error("Western Union catalog had no services");
  }

  const services = groupsRaw.map((group, index) => {
    if (!isRecord(group) || !Array.isArray(group.pay_groups)) {
      throw new Error(`Western Union service ${index} was incomplete`);
    }
    return {
      service: readString(group.service),
      serviceName: readString(group.service_name),
      payGroups: group.pay_groups.map((payGroup, payIndex) => {
        if (!isRecord(payGroup)) {
          throw new Error(`Western Union pay-in ${index}.${payIndex} was incomplete`);
        }
        return {
          fundsIn: readString(payGroup.fund_in),
          fxRate: readNumber(payGroup.fx_rate, `fx rate ${index}.${payIndex}`),
          sendAmount: readNumber(
            payGroup.send_amount,
            `send amount ${index}.${payIndex}`,
          ),
          receiveAmount: readNumber(
            payGroup.receive_amount,
            `receive amount ${index}.${payIndex}`,
          ),
          grossAmount: readNumber(
            payGroup.gross_amount,
            `gross amount ${index}.${payIndex}`,
          ),
          grossFee: readNumber(payGroup.gross_fee, `fee ${index}.${payIndex}`),
          minAmount:
            payGroup.min_amount != null
              ? readNumber(payGroup.min_amount, `min ${index}.${payIndex}`)
              : 0,
          maxAmount:
            payGroup.max_amount != null
              ? readNumber(payGroup.max_amount, `max ${index}.${payIndex}`)
              : Number.POSITIVE_INFINITY,
        };
      }),
    };
  });

  return {
    sendAmount: readNumber(sender.send_amount, "send amount"),
    services,
  };
}

export function selectWuPayGroup(
  catalog: WuCatalog,
  service: string,
): WuPayGroup {
  const group =
    catalog.services.find((item) => item.service === service) ??
    catalog.services.find((item) =>
      service === WU_BANK_SERVICE
        ? /direct to bank/i.test(item.serviceName)
        : /money in minutes/i.test(item.serviceName),
    );
  if (!group) {
    throw new Error(
      `Western Union catalog had no ${
        service === WU_BANK_SERVICE ? "Direct to Bank" : "cash pickup"
      } service`,
    );
  }

  // Standard UK bank transfer: Pay by bank (PA), then Faster Payments (EB), then TR.
  // Ignore Direct to Card, cards (CC), and any promotional headline FX.
  for (const fundsIn of PREFERRED_FUNDS_IN) {
    const match = group.payGroups.find((payGroup) => payGroup.fundsIn === fundsIn);
    if (match) return match;
  }

  throw new Error("Western Union catalog had no UK bank pay-in option");
}

export function quoteFromWuPayGroup(
  amountGbp: number,
  payGroup: WuPayGroup,
): Quote | null {
  if (amountGbp < payGroup.minAmount || amountGbp > payGroup.maxAmount) {
    return null;
  }

  const feeGbp = payGroup.grossFee;
  const netGbp = amountGbp;
  const lkrReceived = payGroup.receiveAmount;
  const totalPaidGbp =
    payGroup.grossAmount > 0 ? payGroup.grossAmount : amountGbp + feeGbp;
  const effectiveRate = lkrReceived / totalPaidGbp;

  return {
    amountGbp,
    feeGbp,
    netGbp,
    lkrReceived,
    effectiveRate,
    behindBoardRate: payGroup.fxRate - effectiveRate,
  };
}

function quoteFromCatalog(
  catalog: WuCatalog,
  service: string,
): Quote | null {
  const payGroup = selectWuPayGroup(catalog, service);
  return quoteFromWuPayGroup(catalog.sendAmount, payGroup);
}

function wuMeta(payout: WuPayout) {
  if (payout === "bank") {
    return {
      id: WU_BANK_PROVIDER_ID,
      name: WU_BANK_PROVIDER_NAME,
      service: WU_BANK_SERVICE,
    };
  }
  return {
    id: WU_CASH_PROVIDER_ID,
    name: WU_CASH_PROVIDER_NAME,
    service: WU_CASH_SERVICE,
  };
}

export function buildWuSnapshot(
  payout: WuPayout,
  catalogs: WuCatalog[],
  asOf: string | null = null,
): ProviderSnapshot {
  const meta = wuMeta(payout);
  const first = catalogs[0];
  if (!first) {
    throw new Error("Western Union catalog list was empty");
  }
  const boardRate = selectWuPayGroup(first, meta.service).fxRate;

  return {
    id: meta.id,
    name: meta.name,
    sourceUrl: WU_RATES_URL,
    pair: "GBPLKR",
    boardRate,
    rateKind: "send",
    asOf,
    quotes: catalogs.map((catalog) => quoteFromCatalog(catalog, meta.service)),
  };
}

function wuRequestId(): string {
  return crypto.randomUUID();
}

async function fetchWuCatalogOnce(amountGbp: number): Promise<Response> {
  const correlationId = wuRequestId();
  return fetch(WU_CATALOG_URL, {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Origin: "https://www.westernunion.com",
      Referer: WU_RATES_URL,
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify({
      header_request: {
        version: "0.5",
        request_type: "PRICECATALOG",
        correlation_id: correlationId,
        transaction_id: `${correlationId}-${Date.now()}`,
      },
      sender: {
        client: "WUCOM",
        channel: "WWEB",
        cty_iso2_ext: "GB",
        curr_iso3: "GBP",
        funds_in: "*",
        send_amount: String(amountGbp),
      },
      receiver: {
        curr_iso3: "LKR",
        cty_iso2_ext: "LK",
        cty_iso2: "LK",
      },
    }),
    signal: AbortSignal.timeout(20000),
  });
}

export async function fetchWuCatalog(amountGbp: number): Promise<WuCatalog> {
  let lastError = "Western Union catalog failed";
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetchWuCatalogOnce(amountGbp);
    if (response.status === 429 || response.status >= 500) {
      lastError = `Western Union catalog returned ${response.status}`;
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 * (attempt + 1)),
      );
      continue;
    }
    if (!response.ok) {
      throw new Error(`Western Union catalog returned ${response.status}`);
    }
    return parseWuCatalog(await response.json());
  }
  throw new Error(lastError);
}

export async function fetchWuCatalogs(): Promise<WuCatalog[]> {
  if (catalogCache && catalogCache.expiresAt > Date.now()) {
    return SEND_AMOUNTS.map((column) => {
      const catalog = catalogCache?.catalogs.get(column.amountGbp);
      if (!catalog) {
        throw new Error(`Western Union cache missed £${column.amountGbp}`);
      }
      return catalog;
    });
  }
  if (catalogInflight) {
    const catalogs = await catalogInflight;
    return SEND_AMOUNTS.map((column) => {
      const catalog = catalogs.get(column.amountGbp);
      if (!catalog) {
        throw new Error(`Western Union cache missed £${column.amountGbp}`);
      }
      return catalog;
    });
  }

  catalogInflight = (async () => {
    const first = await fetchWuCatalog(SEND_AMOUNTS[0].amountGbp);
    const rest = await Promise.all(
      SEND_AMOUNTS.slice(1).map((column) => fetchWuCatalog(column.amountGbp)),
    );
    const catalogs = new Map<number, WuCatalog>();
    catalogs.set(first.sendAmount, first);
    for (const catalog of rest) {
      catalogs.set(catalog.sendAmount, catalog);
    }
    catalogCache = {
      expiresAt: Date.now() + CATALOG_CACHE_MS,
      catalogs,
    };
    return catalogs;
  })();

  try {
    const catalogs = await catalogInflight;
    return SEND_AMOUNTS.map((column) => {
      const catalog = catalogs.get(column.amountGbp);
      if (!catalog) {
        throw new Error(`Western Union catalog missed £${column.amountGbp}`);
      }
      return catalog;
    });
  } finally {
    catalogInflight = null;
  }
}

async function fetchWuSnapshot(payout: WuPayout): Promise<ProviderSnapshot> {
  const catalogs = await fetchWuCatalogs();
  const asOf = new Date().toLocaleDateString("en-GB");
  return buildWuSnapshot(payout, catalogs, asOf);
}

export async function fetchWuBankSnapshot(): Promise<ProviderSnapshot> {
  return fetchWuSnapshot("bank");
}

export async function fetchWuCashSnapshot(): Promise<ProviderSnapshot> {
  return fetchWuSnapshot("cash");
}
