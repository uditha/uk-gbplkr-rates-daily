import assert from "node:assert/strict";
import test from "node:test";
import { newerRates, newerStore } from "./browser-rates";
import type { ComparisonRates } from "@/lib/providers/types";
import type { RatesStoreState } from "./types";

function rates(fetchedAt: string): ComparisonRates {
  return { fetchedAt, amounts: [], providers: [] };
}

test("newerRates keeps a later local snapshot over a stale server snapshot", () => {
  const local = rates("2026-08-20T10:00:00.000Z");
  const server = rates("2026-08-20T08:00:00.000Z");
  assert.equal(newerRates(local, server), local);
  assert.equal(newerRates(server, local), local);
});

test("newerRates returns the only populated snapshot", () => {
  const fresh = rates("2026-08-20T10:00:00.000Z");
  assert.equal(newerRates(null, fresh), fresh);
  assert.equal(newerRates(fresh, null), fresh);
  assert.equal(newerRates(null, null), null);
});

test("newerStore prefers the later admin snapshot", () => {
  const older: RatesStoreState = {
    updatedAt: "2026-08-20T08:00:00.000Z",
    providers: [],
  };
  const newer: RatesStoreState = {
    updatedAt: "2026-08-20T10:00:00.000Z",
    providers: [],
  };
  assert.equal(newerStore(older, newer), newer);
  assert.equal(newerStore(newer, older), newer);
});
