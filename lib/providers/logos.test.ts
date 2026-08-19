import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PROVIDER_LOGOS } from "./logos";
import { PROVIDER_REGISTRY } from "./registry";

describe("PROVIDER_LOGOS", () => {
  it("has a logo file for every registered provider", () => {
    for (const provider of PROVIDER_REGISTRY) {
      assert.ok(
        PROVIDER_LOGOS[provider.id],
        `missing logo for ${provider.id}`,
      );
    }
  });
});
