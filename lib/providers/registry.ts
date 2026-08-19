import type { ProviderSnapshot } from "./types";
import {
  BOC_UK_PROVIDER_ID,
  BOC_UK_PROVIDER_NAME,
  BOC_UK_RATES_URL,
  fetchBocUkSnapshot,
} from "./boc-uk";
import {
  GLOBAL_EXCHANGE_PROVIDER_ID,
  GLOBAL_EXCHANGE_PROVIDER_NAME,
  GLOBAL_EXCHANGE_RATES_URL,
  fetchGlobalExchangeSnapshot,
} from "./global-exchange";
import {
  WISE_PROVIDER_ID,
  WISE_PROVIDER_NAME,
  WISE_RATES_URL,
  fetchWiseSnapshot,
} from "./wise";

export type ProviderDefinition = {
  id: string;
  name: string;
  sourceUrl: string | null;
  fetchSnapshot: (() => Promise<ProviderSnapshot>) | null;
};

export const PROVIDER_REGISTRY: ProviderDefinition[] = [
  {
    id: BOC_UK_PROVIDER_ID,
    name: BOC_UK_PROVIDER_NAME,
    sourceUrl: BOC_UK_RATES_URL,
    fetchSnapshot: fetchBocUkSnapshot,
  },
  {
    id: GLOBAL_EXCHANGE_PROVIDER_ID,
    name: GLOBAL_EXCHANGE_PROVIDER_NAME,
    sourceUrl: GLOBAL_EXCHANGE_RATES_URL,
    fetchSnapshot: fetchGlobalExchangeSnapshot,
  },
  {
    id: WISE_PROVIDER_ID,
    name: WISE_PROVIDER_NAME,
    sourceUrl: WISE_RATES_URL,
    fetchSnapshot: fetchWiseSnapshot,
  },
  {
    id: "taptap-send",
    name: "Taptap Send",
    sourceUrl: null,
    fetchSnapshot: null,
  },
  {
    id: "revolut-standard",
    name: "Revolut (Standard)",
    sourceUrl: null,
    fetchSnapshot: null,
  },
  {
    id: "remitly-standard",
    name: "Remitly (standard)",
    sourceUrl: null,
    fetchSnapshot: null,
  },
  {
    id: "western-union-bank",
    name: "Western Union (bank)",
    sourceUrl: null,
    fetchSnapshot: null,
  },
  {
    id: "wu-cash-pickup-sl",
    name: "WU (cash pickup SL)",
    sourceUrl: null,
    fetchSnapshot: null,
  },
  {
    id: "ria-money-transfer",
    name: "Ria Money Transfer",
    sourceUrl: null,
    fetchSnapshot: null,
  },
];

export function getProviderDefinition(id: string) {
  return PROVIDER_REGISTRY.find((provider) => provider.id === id) ?? null;
}

export function getWiredProviders() {
  return PROVIDER_REGISTRY.filter((provider) => provider.fetchSnapshot);
}
