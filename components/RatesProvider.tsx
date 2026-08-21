"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { comparisonRatesFromStore } from "@/lib/providers/comparison";
import { withoutRetiredProviders } from "@/lib/providers/retired";
import type { ComparisonRates } from "@/lib/providers/types";
import {
  loadBrowserStore,
  saveBrowserRates,
  subscribeBrowserStore,
} from "@/lib/store/browser-rates";
import { mergeStores } from "@/lib/store/snapshot";
import type { RatesStoreState } from "@/lib/store/types";

type RatesContextValue = {
  state: RatesStoreState;
  rates: ComparisonRates | null;
  sharedStore: boolean;
  replaceState: (next: RatesStoreState) => void;
};

const RatesContext = createContext<RatesContextValue | null>(null);

export function RatesProvider({
  initialState,
  sharedStore,
  children,
}: {
  initialState: RatesStoreState;
  sharedStore: boolean;
  children: ReactNode;
}) {
  const [state, setState] = useState(initialState);

  useLayoutEffect(() => {
    setState((current) => {
      const merged = withoutRetiredProviders(
        mergeStores(initialState, current, loadBrowserStore()) ?? current,
      );
      saveBrowserRates(merged);
      return merged;
    });
  }, [initialState]);

  useLayoutEffect(
    () =>
      subscribeBrowserStore((next) => {
        setState((current) =>
          withoutRetiredProviders(mergeStores(current, next) ?? next),
        );
      }),
    [],
  );

  const replaceState = useCallback((next: RatesStoreState) => {
    setState((current) => {
      const merged = withoutRetiredProviders(
        mergeStores(current, next) ?? next,
      );
      saveBrowserRates(merged);
      return merged;
    });
  }, []);

  const value = useMemo(
    () => ({
      state,
      rates: comparisonRatesFromStore(state),
      sharedStore,
      replaceState,
    }),
    [replaceState, sharedStore, state],
  );

  return (
    <RatesContext.Provider value={value}>{children}</RatesContext.Provider>
  );
}

export function useRatesStore(): RatesContextValue {
  const value = useContext(RatesContext);
  if (!value) {
    throw new Error("useRatesStore must be used within RatesProvider");
  }
  return value;
}
