import type { RatesStoreState } from "@/lib/store/types";

export const RETIRED_PROVIDER_IDS = new Set(["wu-cash-pickup-sl"]);

export function isRetiredProviderId(id: string): boolean {
  return RETIRED_PROVIDER_IDS.has(id);
}

export function withoutRetiredProviders(
  state: RatesStoreState,
): RatesStoreState {
  return {
    ...state,
    providers: state.providers.filter(
      (record) => !RETIRED_PROVIDER_IDS.has(record.id),
    ),
  };
}
