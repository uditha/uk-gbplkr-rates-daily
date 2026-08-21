import type { ProviderRecord, RatesStoreState } from "./types";

export function timestampMs(value: string | null | undefined): number {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : 0;
}

export function isNewerRecord(
  current: ProviderRecord,
  incoming: ProviderRecord,
): boolean {
  if (
    incoming.status === "error" &&
    current.status === "ok" &&
    current.snapshot &&
    incoming.snapshot == null
  ) {
    return false;
  }

  const currentTs = timestampMs(current.updatedAt);
  const incomingTs = timestampMs(incoming.updatedAt);
  if (incomingTs !== currentTs) {
    return incomingTs > currentTs;
  }
  if (incoming.status === "ok" && current.status !== "ok") {
    return true;
  }
  if (incoming.snapshot && !current.snapshot) {
    return true;
  }
  return false;
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

export function mergeStores(
  ...candidates: Array<RatesStoreState | null | undefined>
): RatesStoreState | null {
  const present = candidates.filter((store): store is RatesStoreState =>
    Boolean(store),
  );
  if (present.length === 0) {
    return null;
  }

  const byId = new Map<string, ProviderRecord>();
  let updatedAt: string | null = null;

  for (const store of present) {
    if (timestampMs(store.updatedAt) >= timestampMs(updatedAt)) {
      updatedAt = store.updatedAt;
    }
    for (const record of store.providers) {
      const existing = byId.get(record.id);
      if (!existing || isNewerRecord(existing, record)) {
        byId.set(record.id, record);
      }
    }
  }

  return {
    updatedAt,
    providers: [...byId.values()],
  };
}
