import { getProviderDefinition, getWiredProviders } from "@/lib/providers/registry";
import { loadStore, saveProviderRecord } from "@/lib/store/rates-store";
import type { ProviderRecord, RatesStoreState } from "@/lib/store/types";

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

export async function refreshWiredProviders(): Promise<RatesStoreState> {
  for (const provider of getWiredProviders()) {
    try {
      await refreshProvider(provider.id);
    } catch {
      // Error is stored on the provider record.
    }
  }
  return loadStore();
}
