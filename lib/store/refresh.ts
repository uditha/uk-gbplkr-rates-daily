import { getProviderDefinition, getWiredProviders } from "@/lib/providers/registry";
import {
  GLOBAL_EXCHANGE_PROVIDER_ID,
  GLOBAL_EXCHANGE_PROVIDER_NAME,
  GLOBAL_EXCHANGE_RATES_URL,
  buildGlobalExchangeSnapshot,
} from "@/lib/providers/global-exchange";
import { staleWiredProviderIds } from "@/lib/store/freshness";
import { loadStore, saveProviderRecord } from "@/lib/store/rates-store";
import { acquireRemoteLock, releaseRemoteLock } from "@/lib/store/remote-kv";
import type { ProviderRecord, RatesStoreState } from "@/lib/store/types";

const REFRESH_LOCK_MS = 90_000;

type GlobalRefreshLock = typeof globalThis & {
  __gbplkrRefreshLockUntil?: number;
};

export type RefreshIfStaleResult = {
  state: RatesStoreState;
  refreshed: boolean;
  skipped: "fresh" | "locked" | null;
};

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function refreshProvider(providerId: string): Promise<ProviderRecord> {
  const definition = getProviderDefinition(providerId);
  if (!definition) {
    throw new Error(`Unknown provider: ${providerId}`);
  }
  if (!definition.fetchSnapshot) {
    throw new Error(`${definition.name} is not wired yet`);
  }

  const current = await loadStore();
  const previous = current.providers.find((record) => record.id === definition.id);

  try {
    const snapshot = await definition.fetchSnapshot();
    const record: ProviderRecord = {
      id: definition.id,
      name: definition.name,
      wired: true,
      sourceUrl: definition.sourceUrl,
      status: "ok",
      updatedAt: new Date().toISOString(),
      error: null,
      snapshot,
    };
    await saveProviderRecord(record);
    return record;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to refresh provider";
    const record: ProviderRecord = {
      id: definition.id,
      name: definition.name,
      wired: true,
      sourceUrl: definition.sourceUrl,
      status: "error",
      updatedAt: new Date().toISOString(),
      error: message,
      snapshot: previous?.snapshot ?? null,
    };
    await saveProviderRecord(record);
    throw error;
  }
}

export async function applyManualSendRate(
  providerId: string,
  sendRate: number,
): Promise<ProviderRecord> {
  if (providerId !== GLOBAL_EXCHANGE_PROVIDER_ID) {
    throw new Error("Manual rate entry is only set up for Global Exchange");
  }
  if (!Number.isFinite(sendRate) || sendRate <= 0 || sendRate > 1000) {
    throw new Error("Enter the published 1 GBP = LKR figure, for example 451");
  }

  const asOf = new Date().toLocaleDateString("en-GB");
  const snapshot = buildGlobalExchangeSnapshot(sendRate, asOf);
  const record: ProviderRecord = {
    id: GLOBAL_EXCHANGE_PROVIDER_ID,
    name: GLOBAL_EXCHANGE_PROVIDER_NAME,
    wired: true,
    sourceUrl: GLOBAL_EXCHANGE_RATES_URL,
    status: "ok",
    updatedAt: new Date().toISOString(),
    error: null,
    snapshot,
  };
  await saveProviderRecord(record);
  return record;
}

export async function refreshWiredProviders(): Promise<RatesStoreState> {
  for (const [index, provider] of getWiredProviders().entries()) {
    if (index > 0) {
      await wait(400);
    }
    try {
      await refreshProvider(provider.id);
    } catch {
      // Error is stored on the provider record.
    }
  }
  return loadStore();
}

/**
 * Visitor path: scrape only when stored quotes are older than 30 minutes.
 * Desk refresh still calls refreshProvider / refreshWiredProviders immediately.
 */
export async function refreshIfStale(
  now = Date.now(),
): Promise<RefreshIfStaleResult> {
  const current = await loadStore();
  if (staleWiredProviderIds(current, now).length === 0) {
    return { state: current, refreshed: false, skipped: "fresh" };
  }

  const globalLock = globalThis as GlobalRefreshLock;
  if (
    globalLock.__gbplkrRefreshLockUntil &&
    globalLock.__gbplkrRefreshLockUntil > now
  ) {
    return { state: current, refreshed: false, skipped: "locked" };
  }

  const remoteLock = await acquireRemoteLock();
  if (remoteLock === false) {
    return { state: current, refreshed: false, skipped: "locked" };
  }

  globalLock.__gbplkrRefreshLockUntil = now + REFRESH_LOCK_MS;
  try {
    const latest = await loadStore();
    const staleIds = staleWiredProviderIds(latest, Date.now());
    if (staleIds.length === 0) {
      return { state: latest, refreshed: false, skipped: "fresh" };
    }

    for (const [index, providerId] of staleIds.entries()) {
      if (index > 0) {
        await wait(400);
      }
      try {
        await refreshProvider(providerId);
      } catch {
        // Error is stored on the provider record.
      }
    }

    return { state: await loadStore(), refreshed: true, skipped: null };
  } finally {
    globalLock.__gbplkrRefreshLockUntil = 0;
    await releaseRemoteLock();
  }
}
