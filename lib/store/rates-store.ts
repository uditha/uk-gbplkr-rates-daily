import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PROVIDER_REGISTRY } from "@/lib/providers/registry";
import { hasSharedStore, loadRemoteStore, saveRemoteStore } from "./remote-kv";
import { isNewerRecord, mergeStores } from "./snapshot";
import type { ProviderRecord, RatesStoreState } from "./types";

export { hasSharedStore };

type GlobalRates = typeof globalThis & {
  __gbplkrRates?: RatesStoreState;
};

function emptyRecord(id: string): ProviderRecord {
  const definition = PROVIDER_REGISTRY.find((provider) => provider.id === id);
  const wired = Boolean(definition?.fetchSnapshot);

  return {
    id,
    name: definition?.name ?? id,
    wired,
    sourceUrl: definition?.sourceUrl ?? null,
    status: wired ? "idle" : "not_wired",
    updatedAt: null,
    error: null,
    snapshot: null,
  };
}

export function emptyStore(): RatesStoreState {
  return {
    updatedAt: null,
    providers: PROVIDER_REGISTRY.map((provider) => emptyRecord(provider.id)),
  };
}

function mergeWithRegistry(state: RatesStoreState | null): RatesStoreState {
  const existing = new Map(
    (state?.providers ?? []).map((record) => [record.id, record]),
  );

  return {
    updatedAt: state?.updatedAt ?? null,
    providers: PROVIDER_REGISTRY.map((definition) => {
      const record = existing.get(definition.id);
      if (!record) {
        return emptyRecord(definition.id);
      }
      return {
        ...record,
        name: definition.name,
        wired: Boolean(definition.fetchSnapshot),
        sourceUrl: definition.sourceUrl,
        status: definition.fetchSnapshot
          ? record.status === "not_wired"
            ? "idle"
            : record.status
          : "not_wired",
      };
    }),
  };
}

async function readJsonFile(filePath: string): Promise<RatesStoreState | null> {
  try {
    const raw = await readFile(filePath, "utf8");
    return mergeWithRegistry(JSON.parse(raw) as RatesStoreState);
  } catch {
    return null;
  }
}

async function writeStateFile(state: RatesStoreState) {
  const payload = `${JSON.stringify(state, null, 2)}\n`;

  try {
    await writeFile("/tmp/uk-gbplkr-rates.json", payload, "utf8");
  } catch {
    // ignore
  }

  try {
    await mkdir(path.join(process.cwd(), "data"), { recursive: true });
    await writeFile(
      path.join(process.cwd(), "data", "rates.json"),
      payload,
      "utf8",
    );
  } catch {
    // Vercel’s app directory is read-only
  }
}

export async function loadStore(): Promise<RatesStoreState> {
  const globalRates = globalThis as GlobalRates;
  const memory = globalRates.__gbplkrRates
    ? mergeWithRegistry(globalRates.__gbplkrRates)
    : null;
  const fromTmp = await readJsonFile("/tmp/uk-gbplkr-rates.json");
  const fromData = await readJsonFile(
    path.join(process.cwd(), "data", "rates.json"),
  );
  const fromKv = await loadRemoteStore();
  const newest =
    mergeStores(memory, fromTmp, fromData, fromKv) ?? emptyStore();
  const merged = mergeWithRegistry(newest);
  globalRates.__gbplkrRates = merged;
  return merged;
}

export async function saveStore(state: RatesStoreState): Promise<RatesStoreState> {
  const current = (globalThis as GlobalRates).__gbplkrRates ?? null;
  const fromKv = await loadRemoteStore();
  const next = mergeWithRegistry(mergeStores(fromKv, current, state) ?? state);
  (globalThis as GlobalRates).__gbplkrRates = next;
  await writeStateFile(next);
  await saveRemoteStore(next);
  return next;
}

export async function saveProviderRecord(
  record: ProviderRecord,
): Promise<RatesStoreState> {
  const current = await loadStore();
  const providers = current.providers.map((existing) => {
    if (existing.id !== record.id) {
      return existing;
    }
    return isNewerRecord(existing, record) ? record : existing;
  });

  return saveStore({
    updatedAt: record.updatedAt ?? current.updatedAt,
    providers,
  });
}
