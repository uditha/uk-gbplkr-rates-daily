import { SEND_AMOUNTS } from "./amounts";
import type { ProviderSnapshot, Quote } from "./types";

export const TAPTAP_RATES_URL =
  "https://www.taptapsend.com/en-gb/send-money-to/sri-lanka";
export const TAPTAP_FX_RATES_URL = "https://api.taptapsend.com/api/fxRates";
export const TAPTAP_PROVIDER_ID = "taptap-send";
export const TAPTAP_PROVIDER_NAME = "Taptap Send";

const USER_AGENT =
  "Mozilla/5.0 (compatible; uk-gbplkr-rates/1.0; +https://github.com/uditha/uk-gbplkr-rates-daily)";

export type TaptapFeeSchedule = {
  type?: string;
  flatFee?: string | number;
  feePercent?: string | number;
  maxFee?: string | number;
};

export type TaptapCorridor = {
  isoCountryCode: string;
  currency: string;
  fxRate: number;
  currencyScale: number;
  feeSchedule?: TaptapFeeSchedule | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readNumber(value: unknown, label: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Taptap Send missing ${label}`);
  }
  return parsed;
}

export function taptapFeeGbp(
  amountGbp: number,
  feeSchedule?: TaptapFeeSchedule | null,
): number {
  if (!feeSchedule) return 0;
  if (feeSchedule.type && feeSchedule.type !== "standard") return 0;

  const flat = feeSchedule.flatFee != null ? Number(feeSchedule.flatFee) : 0;
  const percent =
    feeSchedule.feePercent != null ? Number(feeSchedule.feePercent) : 0;
  let fee = (Number.isFinite(flat) ? flat : 0) +
    (Number.isFinite(percent) ? 0.01 * percent * amountGbp : 0);

  if (feeSchedule.maxFee != null) {
    const maxFee = Number(feeSchedule.maxFee);
    if (Number.isFinite(maxFee)) fee = Math.min(maxFee, fee);
  }

  return fee;
}

export function parseTaptapGbpLkrCorridor(payload: unknown): TaptapCorridor {
  if (!isRecord(payload) || !Array.isArray(payload.availableCountries)) {
    throw new Error("Taptap Send fxRates payload was not JSON");
  }

  const uk = payload.availableCountries.find(
    (country) =>
      isRecord(country) &&
      country.isoCountryCode === "GB" &&
      country.currency === "GBP",
  );
  if (!isRecord(uk) || !Array.isArray(uk.corridors)) {
    throw new Error("Taptap Send fxRates had no United Kingdom corridor list");
  }

  const sriLanka = uk.corridors.find(
    (corridor) =>
      isRecord(corridor) &&
      corridor.isoCountryCode === "LK" &&
      corridor.currency === "LKR",
  );
  if (!isRecord(sriLanka)) {
    throw new Error("Taptap Send had no GBP to LKR rate");
  }

  const fxRate = readNumber(sriLanka.fxRate, "GBP/LKR fxRate");
  if (fxRate <= 0) {
    throw new Error(`Taptap Send fxRate was not positive: ${sriLanka.fxRate}`);
  }

  return {
    isoCountryCode: "LK",
    currency: "LKR",
    fxRate,
    currencyScale:
      sriLanka.currencyScale != null ? readNumber(sriLanka.currencyScale, "scale") : 2,
    feeSchedule: isRecord(sriLanka.feeSchedule)
      ? (sriLanka.feeSchedule as TaptapFeeSchedule)
      : null,
  };
}

export function quoteTaptapAmount(
  amountGbp: number,
  corridor: TaptapCorridor,
): Quote {
  const feeGbp = taptapFeeGbp(amountGbp, corridor.feeSchedule);
  const netGbp = amountGbp;
  const lkrReceived = Number(
    (netGbp * corridor.fxRate).toFixed(corridor.currencyScale),
  );
  const totalPaidGbp = amountGbp + feeGbp;
  const effectiveRate = lkrReceived / totalPaidGbp;

  return {
    amountGbp,
    feeGbp,
    netGbp,
    lkrReceived,
    effectiveRate,
    behindBoardRate: corridor.fxRate - effectiveRate,
  };
}

export function buildTaptapSnapshot(
  corridor: TaptapCorridor,
  asOf: string | null = null,
): ProviderSnapshot {
  return {
    id: TAPTAP_PROVIDER_ID,
    name: TAPTAP_PROVIDER_NAME,
    sourceUrl: TAPTAP_RATES_URL,
    pair: "GBPLKR",
    boardRate: corridor.fxRate,
    rateKind: "send",
    asOf,
    quotes: SEND_AMOUNTS.map((column) =>
      quoteTaptapAmount(column.amountGbp, corridor),
    ),
  };
}

export async function fetchTaptapFxRates(): Promise<unknown> {
  const response = await fetch(TAPTAP_FX_RATES_URL, {
    cache: "no-store",
    headers: {
      Accept: "*/*",
      Origin: "https://www.taptapsend.com",
      Referer: "https://www.taptapsend.com/",
      "User-Agent": USER_AGENT,
      "Appian-Version": "web/2022-05-03.0",
      "X-Device-Id": "web",
      "X-Device-Model": "web",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Taptap Send fxRates returned ${response.status}`);
  }

  return response.json();
}

export async function fetchTaptapSnapshot(): Promise<ProviderSnapshot> {
  const payload = await fetchTaptapFxRates();
  const corridor = parseTaptapGbpLkrCorridor(payload);
  const asOf = new Date().toLocaleDateString("en-GB");
  return buildTaptapSnapshot(corridor, asOf);
}
