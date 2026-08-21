import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  WU_BANK_SERVICE,
  WU_CASH_SERVICE,
  buildWuSnapshot,
  parseWuCatalog,
  quoteFromWuPayGroup,
  selectWuPayGroup,
  type WuCatalog,
} from "./western-union";

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "__fixtures__",
  "wu-catalog-300.json",
);

function fixtureCatalog(): WuCatalog {
  return parseWuCatalog(JSON.parse(readFileSync(fixturePath, "utf8")));
}

describe("parseWuCatalog", () => {
  it("reads GBP to LKR bank and cash-pickup prices", () => {
    const catalog = fixtureCatalog();
    assert.equal(catalog.sendAmount, 300);
    assert.equal(catalog.services.some((service) => service.service === "500"), true);
    assert.equal(catalog.services.some((service) => service.service === "000"), true);
  });
});

describe("selectWuPayGroup", () => {
  it("uses Faster Payments Direct to Bank, not Pay by bank Best FX", () => {
    const catalog = fixtureCatalog();
    const bank = selectWuPayGroup(catalog, WU_BANK_SERVICE);
    assert.equal(bank.fundsIn, "EB");
    assert.equal(bank.fxRate, 438.5962474);
    assert.equal(selectWuPayGroup(catalog, WU_CASH_SERVICE).fundsIn, "PA");
  });

  it("falls back to bank transfer when Faster Payments is missing", () => {
    const catalog = fixtureCatalog();
    const bank = catalog.services.find((service) => service.service === "500");
    assert.ok(bank);
    const withoutEb: WuCatalog = {
      ...catalog,
      services: [
        {
          ...bank,
          payGroups: bank.payGroups.filter((group) => group.fundsIn !== "EB"),
        },
      ],
    };
    assert.equal(selectWuPayGroup(withoutEb, WU_BANK_SERVICE).fundsIn, "TR");
  });

  it("ignores Direct to Card even when it has a higher FX rate", () => {
    const catalog = fixtureCatalog();
    const bank = selectWuPayGroup(catalog, WU_BANK_SERVICE);
    const withCard: WuCatalog = {
      ...catalog,
      services: [
        {
          service: "201",
          serviceName: "Direct To Card",
          payGroups: [
            {
              ...bank,
              fundsIn: "PA",
              fxRate: 456.6247,
              receiveAmount: 136987.41,
            },
          ],
        },
        ...catalog.services,
      ],
    };
    const group = selectWuPayGroup(withCard, WU_BANK_SERVICE);
    assert.equal(group.fxRate, 438.5962474);
    assert.equal(group.fundsIn, "EB");
  });
});

describe("quoteFromWuPayGroup", () => {
  it("adds the bank fee on top of the send amount", () => {
    const payGroup = selectWuPayGroup(fixtureCatalog(), WU_BANK_SERVICE);
    const quote = quoteFromWuPayGroup(300, payGroup);
    assert.ok(quote);
    assert.equal(quote.feeGbp, 0.99);
    assert.equal(quote.netGbp, 300);
    assert.equal(quote.lkrReceived, 131578.87);
    assert.equal(quote.effectiveRate, 131578.87 / 300.99);
  });

  it("uses the cash-pickup FX rate and fee", () => {
    const payGroup = selectWuPayGroup(fixtureCatalog(), WU_CASH_SERVICE);
    const quote = quoteFromWuPayGroup(300, payGroup);
    assert.ok(quote);
    assert.equal(quote.feeGbp, 2.99);
    assert.equal(quote.lkrReceived, 126534.42);
    assert.equal(quote.effectiveRate, 126534.42 / 302.99);
  });

  it("drops amounts outside the product limit", () => {
    const payGroup = {
      ...selectWuPayGroup(fixtureCatalog(), WU_BANK_SERVICE),
      maxAmount: 1000,
    };
    assert.equal(quoteFromWuPayGroup(2000, payGroup), null);
  });
});

describe("buildWuSnapshot", () => {
  it("builds separate bank and cash-pickup rows from the same catalog", () => {
    const catalogs = [fixtureCatalog()];
    const bank = buildWuSnapshot("bank", catalogs, "19/08/2026");
    const cash = buildWuSnapshot("cash", catalogs, "19/08/2026");
    assert.equal(bank.id, "western-union-bank");
    assert.equal(bank.name, "Western Union (bank)");
    assert.equal(cash.id, "wu-cash-pickup-sl");
    assert.equal(bank.boardRate, 438.5962474);
    assert.equal(cash.boardRate, 421.781385);
    assert.equal(bank.quotes[0]?.lkrReceived, 131578.87);
    assert.equal(cash.quotes[0]?.lkrReceived, 126534.42);
  });
});
