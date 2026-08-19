import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildRemitlySnapshot,
  parseRemitlyEstimate,
  quoteRemitlyAmount,
  remitlyNetFeeGbp,
  remitlyReceiveLkr,
  remitlyTotalPaidGbp,
} from "./remitly";

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "__fixtures__",
  "remitly-estimate-300.json",
);

function fixtureEstimate() {
  return parseRemitlyEstimate(JSON.parse(readFileSync(fixturePath, "utf8")));
}

describe("parseRemitlyEstimate", () => {
  it("reads Standard GBP to LKR rates, fee, and discount", () => {
    const estimate = fixtureEstimate();
    assert.equal(estimate.sendAmount, 300);
    assert.equal(estimate.receiveAmount, 138153);
    assert.equal(estimate.totalFeeAmount, 1.49);
    assert.equal(estimate.feeDiscountAmount, 1.49);
    assert.equal(estimate.baseRate, 449.28);
    assert.equal(estimate.promotionalRate, 460.51);
    assert.equal(estimate.promotionalCapGbp, 500);
    assert.equal(remitlyNetFeeGbp(estimate), 0);
  });
});

describe("remitlyReceiveLkr", () => {
  it("applies the promotional rate to the first £500 then the base rate", () => {
    const estimate = fixtureEstimate();
    assert.equal(remitlyReceiveLkr(300, estimate), 138153);
    assert.equal(remitlyReceiveLkr(500, estimate), 230255);
    assert.equal(remitlyReceiveLkr(2500, estimate), 1128815);
    assert.equal(remitlyReceiveLkr(5000, estimate), 2252015);
  });
});

describe("quoteRemitlyAmount", () => {
  it("waives the £1.49 fee and converts the full send amount", () => {
    const quote = quoteRemitlyAmount(300, fixtureEstimate());
    assert.equal(quote.feeGbp, 0);
    assert.equal(quote.netGbp, 300);
    assert.equal(quote.lkrReceived, 138153);
    assert.equal(quote.effectiveRate, 460.51);
  });

  it("applies leftover fee on top and a send discount to the amount paid", () => {
    const estimate = {
      ...fixtureEstimate(),
      totalFeeAmount: 2.99,
      feeDiscountAmount: 1.49,
      sendDiscountAmount: 0.5,
    };
    assert.equal(remitlyNetFeeGbp(estimate), 1.5);
    assert.equal(remitlyTotalPaidGbp(300, estimate), 301);
    const quote = quoteRemitlyAmount(300, estimate);
    assert.equal(quote.feeGbp, 1.5);
    assert.equal(quote.lkrReceived, 138153);
    assert.equal(quote.effectiveRate, 138153 / 301);
  });
});

describe("buildRemitlySnapshot", () => {
  it("builds a quote for every send-amount column", () => {
    const snapshot = buildRemitlySnapshot(fixtureEstimate(), "19/08/2026");
    assert.equal(snapshot.id, "remitly-standard");
    assert.equal(snapshot.boardRate, 460.51);
    assert.equal(snapshot.quotes.length, 12);
    assert.equal(snapshot.quotes[0]?.amountGbp, 300);
    assert.equal(snapshot.quotes[6]?.lkrReceived, 4498415);
  });
});
