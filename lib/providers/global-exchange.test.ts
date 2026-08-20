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

  it("still reads the board rate when Cloudflare scripts are on the page", () => {
    const html =
      '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"></script>' +
      '<div id="challenge-platform"></div>' +
      "<p>1 GBP = 450 LKR</p>";
    assert.equal(parseGlobalExchangeSriLankaPage(html).sendRate, 450);
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
  it("deducts the fee then converts the remaining GBP so the heatmap shows LKR received", () => {
    const quote = quoteGlobalExchangeAmount(300, 450);
    assert.equal(quote.feeGbp, 3);
    assert.equal(quote.netGbp, 297);
    assert.equal(quote.lkrReceived, 133650);
    assert.equal(quote.effectiveRate, 133650 / 300);
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
