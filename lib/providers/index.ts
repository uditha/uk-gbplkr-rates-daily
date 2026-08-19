import { SEND_AMOUNTS } from "./amounts";
import { fetchBocUkSnapshot } from "./boc-uk";
import type { ComparisonRates } from "./types";

export async function getComparisonRates(): Promise<ComparisonRates> {
  const bocUk = await fetchBocUkSnapshot();

  return {
    fetchedAt: new Date().toISOString(),
    amounts: SEND_AMOUNTS,
    providers: [bocUk],
  };
}
