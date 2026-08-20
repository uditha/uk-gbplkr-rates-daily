import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildGlobalExchangeSnapshot,
  globalExchangeFeeGbp,
  parseGlobalExchangeQuote,
  parseGlobalExchangeSriLankaPage,
  quoteGlobalExchangeAmount,
} from "./global-exchange";

const fixtures = dirname(fileURLToPath(import.meta.url));
const pageFixture = join(fixtures, "__fixtures__", "global-exchange-srlanka.html");
const quoteFixture = join(fixtures, "__fixtures__", "global-exchange-quote-1.json");

describe("parseGlobalExchangeQuote", () => {
  it("reads the homepage calculator rate_string, not a converted leftover amount", () => {
    const payload = JSON.parse(readFileSync(quoteFixture, "utf8"));
    assert.equal(parseGlobalExchangeQuote(payload, 1).sendRate, 451);
  });

  it("does not treat quantity=100 receive amount as the board rate", () => {
    const quote = parseGlobalExchangeQuote(
      {
        exchange: "45,100.00",
        rate_string: "1 GBP = 451.0000 LKR",
      },
      100,
    );
    assert.equal(quote.sendRate, 451);
    assert.equal(quote.lkrReceived, 45100);
  });

  it("falls back to exchange / quantity when rate_string is missing", () => {
    assert.equal(
      parseGlobalExchangeQuote({ exchange: "135,300.00" }, 300).sendRate,
      451,
    );
  });
});

describe("parseGlobalExchangeSriLankaPage", () => {
  it("reads 1 GBP = LKR from the Sri Lanka marketing page", () => {
    const html = readFileSync(pageFixture, "utf8");
    assert.equal(parseGlobalExchangeSriLankaPage(html).sendRate, 451);
  });

  it("still reads the board rate when Cloudflare scripts are on the page", () => {
    const html =
      '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"></script>' +
      '<div id="challenge-platform"></div>' +
      "<p>1 GBP = 450 LKR</p>";
    assert.equal(parseGlobalExchangeSriLankaPage(html).sendRate, 450);
  });

  it("prefers the calculator rate_string over a nearby leftover 1.00 figure", () => {
    const html =
      '<script>{"exchange":"1.00","rate_string":"1 GBP = 451.0000 LKR"}</script>' +
      "<p>You send 1 GBP = 1 LKR placeholder</p>";
    assert.equal(parseGlobalExchangeSriLankaPage(html).sendRate, 451);
  });

  it("skips the £1 calculator leftover and a USD quote before the LKR send rate", () => {
    const html = `
      <div>You send 1 GBP = 1 LKR</div>
      <p>1 GBP = 1.3430 USD</p>
      <h2><span class="fi fi-gb"></span> 1 GBP = <span class="fi fi-lk"></span> 451 LKR</h2>
    `;
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
    assert.equal(snapshot.quotes[0]?.lkrReceived, 297 * 451);
  });
});
