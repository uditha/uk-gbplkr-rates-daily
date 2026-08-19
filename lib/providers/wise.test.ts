import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildWiseSnapshot,
  formatWiseAsOf,
  parseWiseQuoteResponse,
  quoteFromWiseResponse,
  selectWisePayInOption,
  type WiseQuoteResponse,
} from "./wise";

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "__fixtures__",
  "wise-quote-1000.json",
);

function fixtureQuote(): WiseQuoteResponse {
  return parseWiseQuoteResponse(JSON.parse(readFileSync(fixturePath, "utf8")));
}

describe("parseWiseQuoteResponse", () => {
  it("reads the GBP/LKR mid-market rate and PISP option", () => {
    const parsed = fixtureQuote();
    assert.equal(parsed.rate, 450.478);
    assert.equal(parsed.sourceAmount, 1000);
    assert.equal(selectWisePayInOption(parsed.paymentOptions).payIn, "PISP");
  });
});

describe("selectWisePayInOption", () => {
  it("still uses PISP when Wise marks high-amount options disabled", () => {
    const option = selectWisePayInOption([
      {
        payIn: "PISP",
        payOut: "BANK_TRANSFER",
        disabled: true,
        sourceAmount: 100000,
        targetAmount: 44867517.69,
        fee: { total: 418.55 },
      },
    ]);
    assert.equal(option.payIn, "PISP");
    assert.equal(option.fee.total, 418.55);
  });
});

describe("quoteFromWiseResponse", () => {
  it("deducts the fee then converts the remainder at the mid-market rate", () => {
    const quote = quoteFromWiseResponse(fixtureQuote());
    assert.equal(quote.amountGbp, 1000);
    assert.equal(quote.feeGbp, 6.82);
    assert.equal(quote.netGbp, 993.18);
    assert.equal(quote.lkrReceived, 447405.74);
    assert.equal(quote.effectiveRate, 447405.74 / 1000);
    assert.equal(quote.behindBoardRate, 450.478 - 447405.74 / 1000);
  });
});

describe("buildWiseSnapshot", () => {
  it("labels the snapshot as Wise send quotes", () => {
    const quote = quoteFromWiseResponse(fixtureQuote());
    const snapshot = buildWiseSnapshot(
      [quote],
      450.478,
      formatWiseAsOf("2026-08-19T15:47:18Z"),
    );
    assert.equal(snapshot.id, "wise");
    assert.equal(snapshot.name, "Wise");
    assert.equal(snapshot.rateKind, "send");
    assert.equal(snapshot.asOf, "19/08/2026");
    assert.equal(snapshot.quotes.length, 1);
  });
});
