import type { ProviderRecord, RatesStoreState } from "./types";

/** Visitors reuse stored quotes until they are older than this. */
export const RATES_MAX_AGE_MS = 30 * 60 * 1000;

export function isProviderStale(
  record: Pick<ProviderRecord, "wired" | "updatedAt">,
  now = Date.now(),
  maxAgeMs = RATES_MAX_AGE_MS,
): boolean {
  if (!record.wired) return false;
  if (!record.updatedAt) return true;
  const updatedAt = Date.parse(record.updatedAt);
  if (!Number.isFinite(updatedAt)) return true;
  return now - updatedAt > maxAgeMs;
}

export function staleWiredProviderIds(
  state: RatesStoreState,
  now = Date.now(),
  maxAgeMs = RATES_MAX_AGE_MS,
): string[] {
  return state.providers
    .filter((record) => isProviderStale(record, now, maxAgeMs))
    .map((record) => record.id);
}

export function isStoreStale(
  state: RatesStoreState,
  now = Date.now(),
  maxAgeMs = RATES_MAX_AGE_MS,
): boolean {
  return staleWiredProviderIds(state, now, maxAgeMs).length > 0;
}
