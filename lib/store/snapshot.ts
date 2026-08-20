import type { RatesStoreState } from "./types";

export function timestampMs(value: string | null | undefined): number {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : 0;
}

export function isNewerStore(
  current: RatesStoreState,
  incoming: RatesStoreState,
): boolean {
  const currentTs = timestampMs(current.updatedAt);
  const incomingTs = timestampMs(incoming.updatedAt);
  if (incomingTs !== currentTs) {
    return incomingTs > currentTs;
  }

  const snapshotCount = (state: RatesStoreState) =>
    state.providers.filter((record) => record.snapshot != null).length;

  return snapshotCount(incoming) > snapshotCount(current);
}

export function pickNewestStore(
  ...candidates: Array<RatesStoreState | null | undefined>
): RatesStoreState | null {
  return candidates.reduce<RatesStoreState | null>((best, next) => {
    if (!next) return best;
    if (!best) return next;
    return isNewerStore(best, next) ? next : best;
  }, null);
}
