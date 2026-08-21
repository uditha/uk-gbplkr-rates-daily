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
import {
  TAPTAP_PROVIDER_ID,
  TAPTAP_PROVIDER_NAME,
  TAPTAP_RATES_URL,
  fetchTaptapSnapshot,
} from "./taptap-send";
import {
  REVOLUT_PROVIDER_ID,
  REVOLUT_PROVIDER_NAME,
  REVOLUT_RATES_URL,
  fetchRevolutSnapshot,
} from "./revolut";
import {
  REMITLY_PROVIDER_ID,
  REMITLY_PROVIDER_NAME,
  REMITLY_RATES_URL,
  fetchRemitlySnapshot,
} from "./remitly";
import {
  WU_BANK_PROVIDER_ID,
  WU_BANK_PROVIDER_NAME,
  WU_RATES_URL,
  fetchWuBankSnapshot,
} from "./western-union";
import {
  RIA_PROVIDER_ID,
  RIA_PROVIDER_NAME,
  RIA_RATES_URL,
  fetchRiaSnapshot,
} from "./ria";

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
    id: TAPTAP_PROVIDER_ID,
    name: TAPTAP_PROVIDER_NAME,
    sourceUrl: TAPTAP_RATES_URL,
    fetchSnapshot: fetchTaptapSnapshot,
  },
  {
    id: REVOLUT_PROVIDER_ID,
    name: REVOLUT_PROVIDER_NAME,
    sourceUrl: REVOLUT_RATES_URL,
    fetchSnapshot: fetchRevolutSnapshot,
  },
  {
    id: REMITLY_PROVIDER_ID,
    name: REMITLY_PROVIDER_NAME,
    sourceUrl: REMITLY_RATES_URL,
    fetchSnapshot: fetchRemitlySnapshot,
  },
  {
    id: WU_BANK_PROVIDER_ID,
    name: WU_BANK_PROVIDER_NAME,
    sourceUrl: WU_RATES_URL,
    fetchSnapshot: fetchWuBankSnapshot,
  },
  {
    id: RIA_PROVIDER_ID,
    name: RIA_PROVIDER_NAME,
    sourceUrl: RIA_RATES_URL,
    fetchSnapshot: fetchRiaSnapshot,
  },
];

export function getProviderDefinition(id: string) {
  return PROVIDER_REGISTRY.find((provider) => provider.id === id) ?? null;
}

export function getWiredProviders() {
  return PROVIDER_REGISTRY.filter((provider) => provider.fetchSnapshot);
}
