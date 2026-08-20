import assert from "node:assert/strict";
import test from "node:test";
import { isNewerStore, pickNewestStore } from "./snapshot";
import type { RatesStoreState } from "./types";

function store(
  updatedAt: string | null,
  snapshotCount: number,
): RatesStoreState {
  return {
    updatedAt,
    providers: Array.from({ length: snapshotCount }, (_, index) => ({
      id: `p${index}`,
      name: `P${index}`,
      wired: true,
      sourceUrl: null,
      status: "ok",
      updatedAt,
      error: null,
      snapshot: {
        id: `p${index}`,
        name: `P${index}`,
        sourceUrl: "https://example.com",
        pair: "GBPLKR",
        boardRate: 400,
        rateKind: "send",
        asOf: null,
        quotes: [],
      },
    })),
  };
}

test("pickNewestStore prefers a later updatedAt", () => {
  const older = store("2026-08-20T08:00:00.000Z", 3);
  const newer = store("2026-08-20T09:00:00.000Z", 1);
  assert.equal(pickNewestStore(older, newer), newer);
  assert.equal(isNewerStore(older, newer), true);
});

test("pickNewestStore keeps the current snapshot when the incoming one is older", () => {
  const current = store("2026-08-20T09:00:00.000Z", 1);
  const stale = store("2026-08-20T08:00:00.000Z", 9);
  assert.equal(pickNewestStore(current, stale, null), current);
});

test("equal timestamps prefer the store with more provider snapshots", () => {
  const sparse = store("2026-08-20T08:00:00.000Z", 1);
  const full = store("2026-08-20T08:00:00.000Z", 4);
  assert.equal(pickNewestStore(sparse, full), full);
});
