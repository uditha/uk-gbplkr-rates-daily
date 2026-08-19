import { SEND_AMOUNTS } from "./amounts";
import { loadStore } from "@/lib/store/rates-store";
import type { ComparisonRates } from "./types";

export async function getComparisonRates(): Promise<ComparisonRates | null> {
  const store = await loadStore();
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
