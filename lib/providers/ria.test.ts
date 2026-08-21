import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildRiaSnapshot,
  parseRiaEstimate,
  quoteRiaAmount,
  riaReceiveLkr,
} from "./ria";

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "__fixtures__",
  "ria-calculate-300.json",
);

function fixtureEstimate() {
  return parseRiaEstimate(JSON.parse(readFileSync(fixturePath, "utf8")));
}

describe("parseRiaEstimate", () => {
  it("reads the standard GBP to LKR rate and send limit, not the welcome promo", () => {
    const estimate = fixtureEstimate();
    assert.equal(estimate.sendAmount, 300);
    assert.equal(estimate.receiveAmount, 137512.48);
    assert.equal(estimate.transferFee, 0);
    assert.equal(estimate.exchangeRate, 448);
    assert.equal(estimate.promotionalRate, 458.374927800184);
    assert.equal(estimate.maxSendGbp, 8000);
  });

  it("rejects ForceUpdate payloads", () => {
    assert.throws(
      () => parseRiaEstimate({ action: "ForceUpdate", actionValue: "ForceUpdate" }),
      /ForceUpdate/,
    );
  });
});

describe("riaReceiveLkr", () => {
  it("converts every send amount at the standard rate", () => {
    const estimate = fixtureEstimate();
    assert.equal(riaReceiveLkr(300, estimate), 134400);
    assert.equal(riaReceiveLkr(500, estimate), 224000);
    assert.equal(riaReceiveLkr(8000, estimate), 3_584_000);
  });
});

describe("quoteRiaAmount", () => {
  it("converts the full send amount at the standard rate when there is no fee", () => {
    const quote = quoteRiaAmount(300, fixtureEstimate());
    assert.ok(quote);
    assert.equal(quote.feeGbp, 0);
    assert.equal(quote.netGbp, 300);
    assert.equal(quote.lkrReceived, 134400);
    assert.equal(quote.effectiveRate, 448);
  });

  it("deducts the transfer fee then converts the remainder, ignoring the welcome rate", () => {
    const estimate = { ...fixtureEstimate(), transferFee: 2.9 };
    const quote = quoteRiaAmount(300, estimate);
    assert.ok(quote);
    assert.equal(quote.feeGbp, 2.9);
    assert.equal(quote.netGbp, 297.1);
    assert.equal(quote.lkrReceived, 133100.8);
    assert.equal(quote.effectiveRate, 133100.8 / 300);
  });

  it("drops amounts above the published send limit", () => {
    assert.equal(quoteRiaAmount(10000, fixtureEstimate()), null);
  });
});

describe("buildRiaSnapshot", () => {
  it("quotes every column up to £8,000 at the standard rate", () => {
    const snapshot = buildRiaSnapshot(fixtureEstimate(), "19/08/2026");
    assert.equal(snapshot.id, "ria-money-transfer");
    assert.equal(snapshot.boardRate, 448);
    assert.equal(snapshot.quotes.length, 12);
    assert.equal(snapshot.quotes[0]?.lkrReceived, 134400);
    assert.equal(snapshot.quotes[5]?.amountGbp, 5000);
    assert.equal(snapshot.quotes[5]?.lkrReceived, 2_240_000);
    assert.equal(snapshot.quotes[6], null);
  });
});
