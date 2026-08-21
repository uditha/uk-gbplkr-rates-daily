import assert from "node:assert/strict";
import test from "node:test";
import {
  RATES_MAX_AGE_MS,
  isProviderStale,
  isStoreStale,
  staleWiredProviderIds,
} from "./freshness";
import type { ProviderRecord, RatesStoreState } from "./types";

const NOW = Date.parse("2026-08-21T10:00:00.000Z");

function record(
  id: string,
  updatedAt: string | null,
  wired = true,
): ProviderRecord {
  return {
    id,
    name: id,
    wired,
    sourceUrl: null,
    status: wired ? "ok" : "not_wired",
    updatedAt,
    error: null,
    snapshot: null,
  };
}

function store(providers: ProviderRecord[]): RatesStoreState {
  return { updatedAt: providers[0]?.updatedAt ?? null, providers };
}

test("wired quotes older than 30 minutes are stale", () => {
  assert.equal(
    isProviderStale(record("wise", "2026-08-21T09:29:59.000Z"), NOW),
    true,
  );
  assert.equal(
    isProviderStale(record("wise", "2026-08-21T09:30:00.000Z"), NOW),
    false,
  );
  assert.equal(isProviderStale(record("wise", null), NOW), true);
  assert.equal(
    isProviderStale(record("manual", "2026-08-21T01:00:00.000Z", false), NOW),
    false,
  );
});

test("isStoreStale only lists wired providers past the max age", () => {
  const state = store([
    record("wise", "2026-08-21T09:20:00.000Z"),
    record("remitly-standard", "2026-08-21T09:50:00.000Z"),
    record("unwired", null, false),
  ]);

  assert.deepEqual(staleWiredProviderIds(state, NOW), ["wise"]);
  assert.equal(isStoreStale(state, NOW), true);
  assert.equal(isStoreStale(state, NOW, RATES_MAX_AGE_MS), true);
  assert.equal(
    isStoreStale(store([record("wise", "2026-08-21T09:50:00.000Z")]), NOW),
    false,
  );
});
