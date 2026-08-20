import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  parseRevolutRoutesResponse,
  quoteRevolutStandard,
  revolutUpperLimitLkr,
  selectRevolutStandardPlan,
} from "./revolut";

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "__fixtures__",
  "revolut-routes-1000.json",
);

function fixturePayload() {
  return JSON.parse(readFileSync(fixturePath, "utf8"));
}

describe("parseRevolutRoutesResponse", () => {
  it("reads the Standard bank-transfer quote from remittance routes", () => {
    const parsed = parseRevolutRoutesResponse(fixturePayload());
    assert.equal(parsed.sender.amount, 100000);
    assert.equal(parsed.rate.from, "GBP");
    assert.equal(parsed.rate.to, "LKR");
    const plan = selectRevolutStandardPlan(parsed);
    assert.equal(plan.fees.total, 170);
    assert.equal(plan.fees.transfer, 170);
    assert.equal(plan.fees.fx, 0);
  });

  it("accepts the flattened Standard plan object from the calculator", () => {
    const parsed = parseRevolutRoutesResponse({
      id: "STANDARD",
      name: "Standard",
      totalSenderAmount: { amount: 500000, currency: "GBP" },
      senderAmountWithoutFees: { amount: 495250, currency: "GBP" },
      totalRecipientAmount: { amount: 223175867, currency: "LKR" },
      fees: {
        fx: 4000,
        transfer: 750,
        ftt: 0,
        total: 4750,
        currency: "GBP",
      },
    });
    const quote = quoteRevolutStandard(parsed);
    assert.equal(quote?.amountGbp, 5000);
    assert.equal(quote?.feeGbp, 47.5);
    assert.equal(quote?.netGbp, 4952.5);
    assert.equal(quote?.lkrReceived, 2231758.67);
    assert.equal(quote?.effectiveRate, 2231758.67 / 5000);
  });
});

describe("quoteRevolutStandard", () => {
  it("adds Standard fees on top of the send amount for the routes API", () => {
    const quote = quoteRevolutStandard(
      parseRevolutRoutesResponse(fixturePayload()),
    );
    assert.equal(quote?.amountGbp, 1000);
    assert.equal(quote?.feeGbp, 1.7);
    assert.equal(quote?.netGbp, 1000);
    assert.equal(quote?.lkrReceived, 450747);
    assert.equal(quote?.effectiveRate, 450747 / 1001.7);
  });

  it("drops quotes above the LKR send limit", () => {
    const parsed = parseRevolutRoutesResponse(fixturePayload());
    parsed.recipient.amount = 500000000;
    assert.equal(quoteRevolutStandard(parsed), null);
    assert.equal(revolutUpperLimitLkr(parsed), 4999999);
  });
});
