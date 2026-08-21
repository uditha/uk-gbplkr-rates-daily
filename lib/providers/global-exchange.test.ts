import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  GLOBAL_EXCHANGE_CALCULATE_URL,
  GLOBAL_EXCHANGE_HOME_URL,
  GLOBAL_EXCHANGE_RATES_URL,
  GLOBAL_EXCHANGE_READER_PREFIX,
  buildGlobalExchangeSnapshot,
  fetchGlobalExchangeSnapshot,
  globalExchangeFeeGbp,
  parseGlobalExchangeCalculate,
  parseGlobalExchangeSriLankaPage,
  quoteGlobalExchangeAmount,
} from "./global-exchange";

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "__fixtures__",
  "global-exchange-srlanka.html",
);
const calculateFixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "__fixtures__",
  "ge-calculate-1000.json",
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

  it("reads a plain-text 1 GBP = LKR line from an HTML reader", () => {
    assert.equal(
      parseGlobalExchangeSriLankaPage("Have any questions?\n1 GBP = 451 LKR\n").sendRate,
      451,
    );
  });
});

describe("parseGlobalExchangeCalculate", () => {
  it("reads the live 1 GBP = LKR rate and last-updated date", () => {
    const payload = JSON.parse(readFileSync(calculateFixturePath, "utf8"));
    const quote = parseGlobalExchangeCalculate(payload);
    assert.equal(quote.sendRate, 451);
    assert.equal(quote.asOf, "21/08/2026");
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

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

async function withMockedFetch(
  mock: typeof fetch,
  run: () => Promise<void>,
) {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    await run();
  } finally {
    globalThis.fetch = original;
  }
}

describe("fetchGlobalExchangeSnapshot", () => {
  it("uses the live calculator when the homepage is reachable", async () => {
    await withMockedFetch(async (input, init) => {
      const url = requestUrl(input);
      if (url === GLOBAL_EXCHANGE_HOME_URL && init?.method !== "POST") {
        return new Response(
          '<meta name="csrf-token" content="test-csrf">',
          {
            status: 200,
            headers: { "set-cookie": "ge_session=abc" },
          },
        );
      }
      if (url === GLOBAL_EXCHANGE_CALCULATE_URL) {
        assert.equal(init?.method, "POST");
        const headers = new Headers(init?.headers);
        assert.equal(headers.get("X-CSRF-TOKEN"), "test-csrf");
        assert.equal(headers.get("Cookie"), "ge_session=abc");
        return new Response(
          JSON.stringify({
            rate_string: "1 GBP = 452.0000 LKR",
            last_updated: "2026-08-21T08:36:48.000000Z",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("not found", { status: 404 });
    }, async () => {
      const snapshot = await fetchGlobalExchangeSnapshot();
      assert.equal(snapshot.boardRate, 452);
      assert.equal(snapshot.asOf, "21/08/2026");
    });
  });

  it("falls back to a public HTML reader when Cloudflare returns 403", async () => {
    const sriLankaHtml = readFileSync(fixturePath, "utf8");
    await withMockedFetch(async (input) => {
      const url = requestUrl(input);
      if (url.startsWith(GLOBAL_EXCHANGE_READER_PREFIX)) {
        assert.equal(
          url,
          `${GLOBAL_EXCHANGE_READER_PREFIX}${GLOBAL_EXCHANGE_RATES_URL}`,
        );
        return new Response(sriLankaHtml, { status: 200 });
      }
      return new Response("<title>Just a moment...</title>", { status: 403 });
    }, async () => {
      const snapshot = await fetchGlobalExchangeSnapshot();
      assert.equal(snapshot.boardRate, 451);
      assert.equal(snapshot.quotes[0]?.feeGbp, 3);
      assert.equal(snapshot.quotes[0]?.lkrReceived, 297 * 451);
    });
  });
});
