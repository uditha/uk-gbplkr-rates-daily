import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  bocUkFeeGbp,
  buildBocUkSnapshot,
  parseBocUkRatesPage,
  quoteForAmount,
} from "./boc-uk";

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "__fixtures__",
  "boc-uk-rates.html",
);

describe("bocUkFeeGbp", () => {
  it("uses the published RemitWire / BOC UK bands", () => {
    assert.equal(bocUkFeeGbp(300), 3);
    assert.equal(bocUkFeeGbp(1000), 3);
    assert.equal(bocUkFeeGbp(1001), 5);
    assert.equal(bocUkFeeGbp(5000), 5);
    assert.equal(bocUkFeeGbp(5001), 10);
    assert.equal(bocUkFeeGbp(20000), 10);
    assert.equal(bocUkFeeGbp(20001), 20);
    assert.equal(bocUkFeeGbp(50000), 20);
    assert.equal(bocUkFeeGbp(50001), 25);
    assert.equal(bocUkFeeGbp(100000), 25);
    assert.equal(bocUkFeeGbp(100001), 30);
  });
});

describe("parseBocUkRatesPage", () => {
  it("reads the GBP/LKR buying rate from the BOC UK table", () => {
    const html = readFileSync(fixturePath, "utf8");
    const parsed = parseBocUkRatesPage(html);
    assert.equal(parsed.buyingRate, 448);
    assert.equal(parsed.sellingRate, 452);
    assert.equal(parsed.asOf, "19/08/2026");
  });
});

describe("quoteForAmount", () => {
  it("applies the fee then converts the remaining GBP at the buying rate", () => {
    const quote = quoteForAmount(1000, 448);
    assert.equal(quote.feeGbp, 3);
    assert.equal(quote.netGbp, 997);
    assert.equal(quote.lkrReceived, 997 * 448);
    assert.equal(quote.effectiveRate, (997 * 448) / 1000);
    assert.equal(quote.behindBoardRate, 448 - quote.effectiveRate);
  });
});

describe("buildBocUkSnapshot", () => {
  it("builds a quote for every send-amount column", () => {
    const snapshot = buildBocUkSnapshot(448, "19/08/2026");
    assert.equal(snapshot.name, "RemitWire (BOC UK)");
    assert.equal(snapshot.quotes.length, 12);
    assert.equal(snapshot.quotes[0]?.amountGbp, 300);
    assert.equal(snapshot.quotes.at(-1)?.amountGbp, 100000);
  });
});
