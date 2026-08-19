import type { ProviderSnapshot } from "@/lib/providers/types";

export type ProviderStatus = "idle" | "ok" | "error" | "not_wired";

export type ProviderRecord = {
  id: string;
  name: string;
  wired: boolean;
  sourceUrl: string | null;
  status: ProviderStatus;
  updatedAt: string | null;
  error: string | null;
  snapshot: ProviderSnapshot | null;
};

export type RatesStoreState = {
  updatedAt: string | null;
  providers: ProviderRecord[];
};
