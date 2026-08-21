import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { comparisonRatesFromStore } from "./comparison";
import { withoutRetiredProviders } from "./retired";
import type { RatesStoreState } from "@/lib/store/types";

function store(): RatesStoreState {
  return {
    updatedAt: "2026-08-21T08:00:00.000Z",
    providers: [
      {
        id: "western-union-bank",
        name: "Western Union (bank)",
        wired: true,
        sourceUrl: null,
        status: "ok",
        updatedAt: "2026-08-21T08:00:00.000Z",
        error: null,
        snapshot: {
          id: "western-union-bank",
          name: "Western Union (bank)",
          sourceUrl: "https://www.westernunion.com",
          pair: "GBPLKR",
          boardRate: 448,
          rateKind: "send",
          asOf: null,
          quotes: [],
        },
      },
      {
        id: "wu-cash-pickup-sl",
        name: "WU (cash pickup SL)",
        wired: true,
        sourceUrl: null,
        status: "ok",
        updatedAt: "2026-08-21T08:00:00.000Z",
        error: null,
        snapshot: {
          id: "wu-cash-pickup-sl",
          name: "WU (cash pickup SL)",
          sourceUrl: "https://www.westernunion.com",
          pair: "GBPLKR",
          boardRate: 422,
          rateKind: "send",
          asOf: null,
          quotes: [],
        },
      },
    ],
  };
}

describe("withoutRetiredProviders", () => {
  it("drops WU cash pickup from a cached store", () => {
    const next = withoutRetiredProviders(store());
    assert.deepEqual(
      next.providers.map((record) => record.id),
      ["western-union-bank"],
    );
  });
});

describe("comparisonRatesFromStore", () => {
  it("does not put WU cash pickup on the heatmap", () => {
    const rates = comparisonRatesFromStore(store());
    assert.ok(rates);
    assert.deepEqual(
      rates.providers.map((provider) => provider.id),
      ["western-union-bank"],
    );
  });
});
