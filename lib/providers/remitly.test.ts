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
  it("reads Standard GBP to LKR rates and the transfer fee", () => {
    const estimate = fixtureEstimate();
    assert.equal(estimate.sendAmount, 300);
    assert.equal(estimate.receiveAmount, 134784);
    assert.equal(estimate.totalChargeAmount, 301.49);
    assert.equal(estimate.totalFeeAmount, 1.49);
    assert.equal(estimate.feeDiscountAmount, 0);
    assert.equal(estimate.baseRate, 449.28);
    assert.equal(estimate.promotionalRate, null);
    assert.equal(estimate.promotionalCapGbp, null);
    assert.equal(remitlyNetFeeGbp(estimate), 1.49);
  });

  it("still parses a welcome-rate payload without using it for quotes", () => {
    const estimate = parseRemitlyEstimate({
      estimate: {
        conduit: {
          source_currency: { alpha3: "GBP" },
          target_currency: { alpha3: "LKR" },
        },
        discount: {
          fee_discount_amount: "1.49",
          send_discount_amount: "0.00",
        },
        exchange_rate: {
          base_rate: "449.28",
          capped_promotional_exchange_rate_amount: "500.00",
          promotional_exchange_rate: "460.51",
        },
        fee: { total_fee_amount: "1.49" },
        receive_amount: "138153.00",
        send_amount: "300.00",
        total_charge_amount: "300.00",
      },
    });
    assert.equal(estimate.promotionalRate, 460.51);
    assert.equal(estimate.promotionalCapGbp, 500);
    assert.equal(remitlyReceiveLkr(300, estimate), 134784);
    assert.equal(quoteRemitlyAmount(300, estimate).effectiveRate, 449.28);
  });
});

describe("remitlyReceiveLkr", () => {
  it("converts every send amount at the standard rate", () => {
    const estimate = fixtureEstimate();
    assert.equal(remitlyReceiveLkr(300, estimate), 134784);
    assert.equal(remitlyReceiveLkr(500, estimate), 224640);
    assert.equal(remitlyReceiveLkr(2500, estimate), 1123200);
    assert.equal(remitlyReceiveLkr(5000, estimate), 2246400);
  });
});

describe("quoteRemitlyAmount", () => {
  it("adds the £1.49 fee on top and converts the full send amount at the standard rate", () => {
    const quote = quoteRemitlyAmount(300, fixtureEstimate());
    assert.equal(quote.feeGbp, 1.49);
    assert.equal(quote.netGbp, 300);
    assert.equal(quote.lkrReceived, 134784);
    assert.equal(quote.effectiveRate, 134784 / 301.49);
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
    assert.equal(quote.lkrReceived, 134784);
    assert.equal(quote.effectiveRate, 134784 / 301);
  });
});

describe("buildRemitlySnapshot", () => {
  it("builds a quote for every send-amount column at the standard rate", () => {
    const snapshot = buildRemitlySnapshot(fixtureEstimate(), "19/08/2026");
    assert.equal(snapshot.id, "remitly-standard");
    assert.equal(snapshot.boardRate, 449.28);
    assert.equal(snapshot.quotes.length, 12);
    assert.equal(snapshot.quotes[0]?.amountGbp, 300);
    assert.equal(snapshot.quotes[6]?.lkrReceived, 4_492_800);
  });
});
