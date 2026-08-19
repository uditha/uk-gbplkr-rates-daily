import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildGlobalExchangeSnapshot,
  globalExchangeFeeGbp,
  parseGlobalExchangeSriLankaPage,
  quoteGlobalExchangeAmount,
} from "./global-exchange";

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "__fixtures__",
  "global-exchange-srlanka.html",
);

describe("parseGlobalExchangeSriLankaPage", () => {
  it("reads 1 GBP = LKR from the Sri Lanka marketing page", () => {
    const html = readFileSync(fixturePath, "utf8");
    assert.equal(parseGlobalExchangeSriLankaPage(html).sendRate, 451);
  });
});

describe("globalExchangeFeeGbp", () => {
  it("charges £3 up to £1000 and £5 above that", () => {
    assert.equal(globalExchangeFeeGbp(300), 3);
    assert.equal(globalExchangeFeeGbp(1000), 3);
    assert.equal(globalExchangeFeeGbp(1001), 5);
    assert.equal(globalExchangeFeeGbp(100000), 5);
  });
});

describe("quoteGlobalExchangeAmount", () => {
  it("converts the full send amount and adds the fee on top", () => {
    const quote = quoteGlobalExchangeAmount(1000, 451);
    assert.equal(quote.feeGbp, 3);
    assert.equal(quote.netGbp, 1000);
    assert.equal(quote.lkrReceived, 451000);
    assert.equal(quote.effectiveRate, 451000 / 1003);
  });
});

describe("buildGlobalExchangeSnapshot", () => {
  it("builds a quote for every send-amount column", () => {
    const snapshot = buildGlobalExchangeSnapshot(451);
    assert.equal(snapshot.name, "Global Exchange (Smart)");
    assert.equal(snapshot.rateKind, "send");
    assert.equal(snapshot.quotes.length, 12);
  });
});
