import { comparisonRatesFromStore } from "@/lib/providers/comparison";
import type { ComparisonRates } from "@/lib/providers/types";
import { isNewerStore } from "@/lib/store/snapshot";
import type { RatesStoreState } from "@/lib/store/types";

export const BROWSER_RATES_KEY = "uk-gbplkr-store-v1";
const STORE_EVENT = "uk-gbplkr-store";

function isStoreState(value: unknown): value is RatesStoreState {
  if (typeof value !== "object" || value == null) return false;
  const record = value as Partial<RatesStoreState>;
  if (!Array.isArray(record.providers)) return false;
  if (record.updatedAt != null && typeof record.updatedAt !== "string") {
    return false;
  }
  const first = record.providers[0];
  if (!first) return true;
  return typeof first.id === "string" && "snapshot" in first;
}

export function saveBrowserRates(state: RatesStoreState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BROWSER_RATES_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(STORE_EVENT, { detail: state }));
}

export function loadBrowserStore(): RatesStoreState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(BROWSER_RATES_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isStoreState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function loadBrowserRates(): ComparisonRates | null {
  const state = loadBrowserStore();
  return state ? comparisonRatesFromStore(state) : null;
}

export function newerStore(
  current: RatesStoreState | null,
  next: RatesStoreState | null,
): RatesStoreState | null {
  if (!next) return current;
  if (!current) return next;
  return isNewerStore(current, next) ? next : current;
}

export function newerRates(
  current: ComparisonRates | null,
  next: ComparisonRates | null,
): ComparisonRates | null {
  if (!next) return current;
  if (!current) return next;
  const currentAt = Date.parse(current.fetchedAt);
  const nextAt = Date.parse(next.fetchedAt);
  if (
    Number.isFinite(nextAt) &&
    Number.isFinite(currentAt) &&
    nextAt < currentAt
  ) {
    return current;
  }
  return next;
}

export function subscribeBrowserStore(
  onChange: (state: RatesStoreState) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== BROWSER_RATES_KEY || !event.newValue) return;
    try {
      const parsed: unknown = JSON.parse(event.newValue);
      if (isStoreState(parsed)) onChange(parsed);
    } catch {
      // ignore malformed values
    }
  };

  const handleCustom = (event: Event) => {
    const detail = (event as CustomEvent<unknown>).detail;
    if (isStoreState(detail)) onChange(detail);
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(STORE_EVENT, handleCustom);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(STORE_EVENT, handleCustom);
  };
}
