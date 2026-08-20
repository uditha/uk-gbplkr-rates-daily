import { SEND_AMOUNTS } from "./amounts";
import { loadStore } from "@/lib/store/rates-store";
import type { ComparisonRates } from "./types";
import type { RatesStoreState } from "@/lib/store/types";

export function comparisonRatesFromStore(
  store: RatesStoreState,
): ComparisonRates | null {
  const providers = store.providers
    .map((record) => record.snapshot)
    .filter((snapshot) => snapshot != null);

  if (providers.length === 0) {
    return null;
  }

  return {
    fetchedAt: store.updatedAt ?? new Date().toISOString(),
    amounts: SEND_AMOUNTS,
    providers,
  };
}

export async function getComparisonRates(): Promise<ComparisonRates | null> {
  return comparisonRatesFromStore(await loadStore());
}
