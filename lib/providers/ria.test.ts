import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { SEND_AMOUNTS } from "./amounts";
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
  it("reads the standard GBP to LKR rate, debit-card fee, and send limit, not the welcome promo", () => {
    const estimate = fixtureEstimate();
    assert.equal(estimate.sendAmount, 300);
    assert.equal(estimate.receiveAmount, 137512.48);
    assert.equal(estimate.transferFee, 2.9);
    assert.equal(estimate.totalChargeAmount, 302.9);
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
    const quote = quoteRiaAmount(300, { ...fixtureEstimate(), transferFee: 0 });
    assert.ok(quote);
    assert.equal(quote.feeGbp, 0);
    assert.equal(quote.netGbp, 300);
    assert.equal(quote.lkrReceived, 134400);
    assert.equal(quote.effectiveRate, 448);
  });

  it("deducts the debit-card fee then converts the remainder, ignoring the welcome rate", () => {
    const quote = quoteRiaAmount(300, fixtureEstimate());
    assert.ok(quote);
    assert.equal(quote.feeGbp, 2.9);
    assert.equal(quote.netGbp, 297.1);
    assert.equal(quote.lkrReceived, 133100.8);
    assert.equal(quote.effectiveRate, 133100.8 / 300);
  });

  it("uses that column's own fee, which is higher at £1,000", () => {
    const quote = quoteRiaAmount(1000, {
      ...fixtureEstimate(),
      sendAmount: 1000,
      transferFee: 4.9,
    });
    assert.ok(quote);
    assert.equal(quote.feeGbp, 4.9);
    assert.equal(quote.netGbp, 995.1);
    assert.equal(quote.lkrReceived, 445804.8);
    assert.equal(quote.effectiveRate, 445804.8 / 1000);
  });

  it("drops amounts above the published send limit", () => {
    assert.equal(quoteRiaAmount(10000, fixtureEstimate()), null);
  });
});

describe("buildRiaSnapshot", () => {
  it("quotes every column up to £8,000 after deducting the debit-card fee", () => {
    const snapshot = buildRiaSnapshot(fixtureEstimate(), "19/08/2026");
    assert.equal(snapshot.id, "ria-money-transfer");
    assert.equal(snapshot.boardRate, 448);
    assert.equal(snapshot.quotes.length, SEND_AMOUNTS.length);
    assert.equal(snapshot.quotes[0]?.lkrReceived, 133100.8);
    assert.equal(snapshot.quotes[0]?.effectiveRate, 133100.8 / 300);
    assert.equal(snapshot.quotes[5]?.amountGbp, 5000);
    assert.equal(snapshot.quotes[5]?.lkrReceived, 2_238_700.8);
    assert.equal(snapshot.quotes[6], null);
  });
});
