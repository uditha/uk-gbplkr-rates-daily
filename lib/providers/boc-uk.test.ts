import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  bocUkFeeGbp,
  buildBocUkSnapshot,
  parseBocUkRatesPage,
  parseBocUkRatesPayload,
  quoteForAmount,
  snapshotFromBocUkRateCard,
} from "./boc-uk";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "__fixtures__");
const fixturePath = join(fixturesDir, "boc-uk-rates.html");
const ercFixturePath = join(fixturesDir, "boc-uk-rates-erc.html");
const apiFixturePath = join(fixturesDir, "boc-uk-rates.json");

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
  it("reads the GBP/LKR buying rate from the older BOC UK table", () => {
    const html = readFileSync(fixturePath, "utf8");
    const parsed = parseBocUkRatesPage(html);
    assert.equal(parsed.buyingRate, 448);
    assert.equal(parsed.sellingRate, 452);
    assert.equal(parsed.asOf, "19/08/2026");
  });

  it("reads the GBP/LKR buying rate from the current exchange-rate table", () => {
    const html = readFileSync(ercFixturePath, "utf8");
    const parsed = parseBocUkRatesPage(html);
    assert.equal(parsed.buyingRate, 446);
    assert.equal(parsed.sellingRate, 450);
    assert.equal(parsed.asOf, "05/11/2026");
  });
});

describe("parseBocUkRatesPayload", () => {
  it("reads the calculator buying rate, added fee, and date", () => {
    const card = parseBocUkRatesPayload(
      JSON.parse(readFileSync(apiFixturePath, "utf8")),
    );
    assert.equal(card.buyingRate, 446);
    assert.equal(card.sellingRate, 450);
    assert.equal(card.feeMode, "add");
    assert.equal(card.asOf, "05/11/2026");
    assert.equal(card.slabs[0]?.value, 3);
    assert.equal(card.slabs.at(-1)?.value, 30);
  });
});

describe("quoteForAmount", () => {
  it("converts the full send amount and adds the fee on top", () => {
    const quote = quoteForAmount(1000, 448);
    assert.equal(quote.feeGbp, 3);
    assert.equal(quote.netGbp, 1000);
    assert.equal(quote.lkrReceived, 448000);
    assert.equal(quote.effectiveRate, 448000 / 1003);
    assert.equal(quote.behindBoardRate, 448 - quote.effectiveRate);
  });

  it("deducts the fee before conversion when the calculator is in deduct mode", () => {
    const quote = quoteForAmount(1000, 448, { feeMode: "deduct" });
    assert.equal(quote.feeGbp, 3);
    assert.equal(quote.netGbp, 997);
    assert.equal(quote.lkrReceived, 997 * 448);
    assert.equal(quote.effectiveRate, (997 * 448) / 1000);
  });
});

describe("buildBocUkSnapshot", () => {
  it("builds a quote for every send-amount column", () => {
    const snapshot = buildBocUkSnapshot(448, "19/08/2026");
    assert.equal(snapshot.name, "RemitWire (BOC UK)");
    assert.equal(snapshot.quotes.length, 12);
    assert.equal(snapshot.quotes[0]?.amountGbp, 300);
    assert.equal(snapshot.quotes[0]?.lkrReceived, 300 * 448);
    assert.equal(snapshot.quotes.at(-1)?.amountGbp, 100000);
  });

  it("uses the live calculator card, including the fee added on top", () => {
    const card = parseBocUkRatesPayload(
      JSON.parse(readFileSync(apiFixturePath, "utf8")),
    );
    const snapshot = snapshotFromBocUkRateCard(card);
    assert.equal(snapshot.boardRate, 446);
    assert.equal(snapshot.asOf, "05/11/2026");
    assert.equal(snapshot.quotes[2]?.amountGbp, 1000);
    assert.equal(snapshot.quotes[2]?.feeGbp, 3);
    assert.equal(snapshot.quotes[2]?.lkrReceived, 446000);
    assert.equal(snapshot.quotes[2]?.effectiveRate, 446000 / 1003);
  });
});
