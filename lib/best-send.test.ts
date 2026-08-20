import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bestQuoteForAmount,
  formatCompactGbp,
  parseSendAmount,
  topQuotesForAmount,
} from "./best-send";
import type { ComparisonRates, Quote } from "./providers/types";

function quote(
  amountGbp: number,
  effectiveRate: number,
  lkrReceived = effectiveRate * amountGbp,
): Quote {
  return {
    amountGbp,
    feeGbp: 0,
    netGbp: amountGbp,
    lkrReceived,
    effectiveRate,
    behindBoardRate: 0,
  };
}

function fixture(): ComparisonRates {
  return {
    fetchedAt: "2026-08-20T00:00:00.000Z",
    amounts: [
      { amountGbp: 500, label: "500" },
      { amountGbp: 1000, label: "1000" },
      { amountGbp: 2000, label: "2000" },
    ],
    providers: [
      {
        id: "wise",
        name: "Wise",
        sourceUrl: "https://wise.com",
        pair: "GBPLKR",
        boardRate: 447,
        rateKind: "send",
        asOf: null,
        quotes: [quote(500, 447), quote(1000, 446.5), null],
      },
      {
        id: "taptap",
        name: "Taptap Send",
        sourceUrl: "https://taptapsend.com",
        pair: "GBPLKR",
        boardRate: 447.5,
        rateKind: "send",
        asOf: null,
        quotes: [quote(500, 447.5), quote(1000, 447.5), quote(2000, 447.5)],
      },
      {
        id: "remitwire",
        name: "RemitWire (BOC UK)",
        sourceUrl: "https://bankofceylon.co.uk",
        pair: "GBPLKR",
        boardRate: 448,
        rateKind: "buying",
        asOf: null,
        quotes: [quote(500, 445), quote(1000, 445.8), quote(2000, 446)],
      },
      {
        id: "revolut",
        name: "Revolut (Standard)",
        sourceUrl: "https://revolut.com",
        pair: "GBPLKR",
        boardRate: 448,
        rateKind: "send",
        asOf: null,
        quotes: [quote(500, 448), quote(1000, 448.2), quote(2000, 448.1)],
      },
      {
        id: "ria",
        name: "Ria Money Transfer",
        sourceUrl: "https://riamoneytransfer.com",
        pair: "GBPLKR",
        boardRate: 448,
        rateKind: "send",
        asOf: null,
        quotes: [quote(500, 444), quote(1000, 444.2), quote(2000, 444.1)],
      },
    ],
  };
}

describe("parseSendAmount", () => {
  it("reads plain, comma, and k suffixes", () => {
    assert.equal(parseSendAmount("1000"), 1000);
    assert.equal(parseSendAmount("£1,000"), 1000);
    assert.equal(parseSendAmount("2.5k"), 2500);
    assert.equal(parseSendAmount("100K"), 100000);
  });

  it("rejects empty or non-positive values", () => {
    assert.equal(parseSendAmount(""), null);
    assert.equal(parseSendAmount("abc"), null);
    assert.equal(parseSendAmount("0"), null);
    assert.equal(parseSendAmount("-10"), null);
  });
});

describe("bestQuoteForAmount", () => {
  it("picks the highest effective rate at an exact column", () => {
    const pick = bestQuoteForAmount(fixture(), 1000);
    assert.equal(pick?.provider.id, "revolut");
    assert.equal(pick?.column.amountGbp, 1000);
    assert.equal(pick?.estimatedLkr, 448.2 * 1000);
  });

  it("snaps to the nearest stored column, preferring the lower amount on a tie", () => {
    const pick = bestQuoteForAmount(fixture(), 1500);
    assert.equal(pick?.column.amountGbp, 1000);
    assert.equal(pick?.estimatedLkr, 448.2 * 1500);
  });

  it("skips a nearer column when nobody has a quote there", () => {
    const pick = bestQuoteForAmount(fixture(), 2000);
    assert.equal(pick?.provider.id, "revolut");
    assert.equal(pick?.column.amountGbp, 2000);
  });

  it("returns null for invalid amounts", () => {
    assert.equal(bestQuoteForAmount(fixture(), 0), null);
    assert.equal(bestQuoteForAmount(fixture(), Number.NaN), null);
  });
});

describe("topQuotesForAmount", () => {
  it("returns the top five providers as ranks 1 through 5", () => {
    const picks = topQuotesForAmount(fixture(), 1000);
    assert.deepEqual(
      picks.map((pick) => [pick.rank, pick.provider.id]),
      [
        [1, "revolut"],
        [2, "taptap"],
        [3, "wise"],
        [4, "remitwire"],
        [5, "ria"],
      ],
    );
  });

  it("returns fewer ranks when a column has fewer quotes", () => {
    const picks = topQuotesForAmount(fixture(), 2000);
    assert.deepEqual(
      picks.map((pick) => pick.provider.id),
      ["revolut", "taptap", "remitwire", "ria"],
    );
  });
});

describe("formatCompactGbp", () => {
  it("uses k suffixes from £1000", () => {
    assert.equal(formatCompactGbp(500), "£500");
    assert.equal(formatCompactGbp(2500), "£2.5k");
    assert.equal(formatCompactGbp(100000), "£100k");
  });
});
