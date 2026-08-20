import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { describe, it } from "node:test";
import { PROVIDER_LOGOS } from "./logos";
import { PROVIDER_REGISTRY } from "./registry";

describe("PROVIDER_LOGOS", () => {
  it("has a logo file for every registered provider", () => {
    for (const provider of PROVIDER_REGISTRY) {
      const logo = PROVIDER_LOGOS[provider.id];
      assert.ok(logo, `missing logo for ${provider.id}`);
      const filePath = `public${logo.src}`;
      assert.ok(existsSync(filePath), `missing logo file ${filePath}`);
    }
  });
});
