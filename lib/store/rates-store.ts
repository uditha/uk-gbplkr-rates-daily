import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PROVIDER_REGISTRY } from "@/lib/providers/registry";
import type { ProviderRecord, RatesStoreState } from "./types";

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

async function readStateFile(): Promise<RatesStoreState | null> {
  try {
    const raw = await readFile("/tmp/uk-gbplkr-rates.json", "utf8");
    return mergeWithRegistry(JSON.parse(raw) as RatesStoreState);
  } catch {
    // fall through to the committed snapshot
  }

  try {
    const raw = await readFile(
      path.join(process.cwd(), "data", "rates.json"),
      "utf8",
    );
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
  if (globalRates.__gbplkrRates) {
    return mergeWithRegistry(globalRates.__gbplkrRates);
  }

  const fromDisk = await readStateFile();
  const state = fromDisk ?? emptyStore();
  globalRates.__gbplkrRates = state;
  return state;
}

export async function saveStore(state: RatesStoreState): Promise<RatesStoreState> {
  const next = mergeWithRegistry(state);
  (globalThis as GlobalRates).__gbplkrRates = next;
  await writeStateFile(next);
  return next;
}

export async function saveProviderRecord(
  record: ProviderRecord,
): Promise<RatesStoreState> {
  const current = await loadStore();
  const providers = current.providers.map((existing) =>
    existing.id === record.id ? record : existing,
  );

  return saveStore({
    updatedAt: record.updatedAt ?? current.updatedAt,
    providers,
  });
}
