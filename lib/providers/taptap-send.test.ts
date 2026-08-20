import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildTaptapSnapshot,
  parseTaptapGbpLkrCorridor,
  quoteTaptapAmount,
  taptapFeeGbp,
} from "./taptap-send";

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "__fixtures__",
  "taptap-fx-rates.json",
);

function fixturePayload() {
  return JSON.parse(readFileSync(fixturePath, "utf8"));
}

describe("parseTaptapGbpLkrCorridor", () => {
  it("reads the UK to Sri Lanka fxRate", () => {
    const corridor = parseTaptapGbpLkrCorridor(fixturePayload());
    assert.equal(corridor.fxRate, 447.5);
    assert.equal(corridor.currency, "LKR");
    assert.equal(corridor.feeSchedule, null);
  });
});

describe("taptapFeeGbp", () => {
  it("is zero when the Sri Lanka corridor has no fee schedule", () => {
    assert.equal(taptapFeeGbp(1000, null), 0);
  });

  it("uses a standard flat fee when the corridor publishes one", () => {
    assert.equal(taptapFeeGbp(50, { type: "standard", flatFee: "0.99" }), 0.99);
  });
});

describe("quoteTaptapAmount", () => {
  it("converts the full send amount at the published rate with no Sri Lanka fee", () => {
    const corridor = parseTaptapGbpLkrCorridor(fixturePayload());
    const quote = quoteTaptapAmount(1000, corridor);
    assert.equal(quote.feeGbp, 0);
    assert.equal(quote.netGbp, 1000);
    assert.equal(quote.lkrReceived, 447500);
    assert.equal(quote.effectiveRate, 447.5);
    assert.equal(quote.behindBoardRate, 0);
  });
});

describe("buildTaptapSnapshot", () => {
  it("builds a quote for every send-amount column", () => {
    const corridor = parseTaptapGbpLkrCorridor(fixturePayload());
    const snapshot = buildTaptapSnapshot(corridor, "19/08/2026");
    assert.equal(snapshot.id, "taptap-send");
    assert.equal(snapshot.name, "Taptap Send");
    assert.equal(snapshot.boardRate, 447.5);
    assert.equal(snapshot.quotes.length, 12);
    assert.equal(snapshot.quotes[0]?.amountGbp, 300);
  });
});
