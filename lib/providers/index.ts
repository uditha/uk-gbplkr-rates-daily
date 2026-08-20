import { loadStore } from "@/lib/store/rates-store";
import { comparisonRatesFromStore } from "./comparison";
import type { ComparisonRates } from "./types";

export { comparisonRatesFromStore } from "./comparison";

export async function getComparisonRates(): Promise<ComparisonRates | null> {
  return comparisonRatesFromStore(await loadStore());
}
