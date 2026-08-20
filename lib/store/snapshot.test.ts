import assert from "node:assert/strict";
import test from "node:test";
import { isNewerStore, mergeStores, pickNewestStore } from "./snapshot";
import type { ProviderRecord, RatesStoreState } from "./types";

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

function record(
  id: string,
  updatedAt: string,
  boardRate: number,
  status: ProviderRecord["status"] = "ok",
): ProviderRecord {
  return {
    id,
    name: id,
    wired: true,
    sourceUrl: null,
    status,
    updatedAt,
    error: status === "error" ? "failed" : null,
    snapshot: {
      id,
      name: id,
      sourceUrl: "https://example.com",
      pair: "GBPLKR",
      boardRate,
      rateKind: "send",
      asOf: null,
      quotes: [],
    },
  };
}

test("mergeStores keeps a newer Remitly quote over a stale heatmap snapshot", () => {
  const stale: RatesStoreState = {
    updatedAt: "2026-08-20T08:28:40.221Z",
    providers: [
      record("remitly-standard", "2026-08-20T08:25:52.014Z", 449.28, "error"),
      record("wise", "2026-08-20T08:28:40.221Z", 451),
    ],
  };
  const refreshed: RatesStoreState = {
    updatedAt: "2026-08-20T09:10:00.000Z",
    providers: [
      record("remitly-standard", "2026-08-20T09:10:00.000Z", 452.4),
      record("wise", "2026-08-20T08:28:40.221Z", 451),
    ],
  };

  const merged = mergeStores(stale, refreshed);
  assert.ok(merged);
  const remitly = merged.providers.find((item) => item.id === "remitly-standard");
  assert.equal(remitly?.snapshot?.boardRate, 452.4);
  assert.equal(remitly?.status, "ok");
  assert.equal(merged.updatedAt, "2026-08-20T09:10:00.000Z");
});

test("mergeStores does not let a later Remitly 429 replace a successful quote", () => {
  const success: RatesStoreState = {
    updatedAt: "2026-08-20T09:10:00.000Z",
    providers: [record("remitly-standard", "2026-08-20T09:10:00.000Z", 452.4)],
  };
  const rateLimited: RatesStoreState = {
    updatedAt: "2026-08-20T09:12:00.000Z",
    providers: [
      record("remitly-standard", "2026-08-20T09:12:00.000Z", 449.28, "error"),
    ],
  };

  const merged = mergeStores(success, rateLimited);
  const remitly = merged?.providers.find((item) => item.id === "remitly-standard");
  assert.equal(remitly?.status, "ok");
  assert.equal(remitly?.snapshot?.boardRate, 452.4);
});
