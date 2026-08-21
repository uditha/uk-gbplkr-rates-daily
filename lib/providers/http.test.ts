import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isCloudflareChallenge,
  isUsableHtmlDocument,
  parseIncludedHttpResponse,
} from "./http";

describe("parseIncludedHttpResponse", () => {
  it("reads the final status, body, and cookies after redirects", () => {
    const raw = [
      "HTTP/1.1 301 Moved Permanently",
      "location: https://example.com/",
      "",
      "HTTP/2 200",
      "set-cookie: session=abc; Path=/",
      "set-cookie: csrf=tok; Path=/",
      "content-type: text/html",
      "",
      "<p>1 GBP = 451 LKR</p>",
      "",
    ].join("\n");

    const parsed = parseIncludedHttpResponse(raw);
    assert.equal(parsed?.status, 200);
    assert.equal(parsed?.html, "<p>1 GBP = 451 LKR</p>\n");
    assert.equal(parsed?.cookies, "session=abc; csrf=tok");
  });
});

describe("isUsableHtmlDocument", () => {
  it("rejects Cloudflare challenge pages even when the status is 200", () => {
    assert.equal(isCloudflareChallenge("<title>Just a moment...</title>"), true);
    assert.equal(
      isUsableHtmlDocument(200, "<title>Just a moment...</title>"),
      false,
    );
    assert.equal(isUsableHtmlDocument(200, "<p>1 GBP = 451 LKR</p>"), true);
  });
});
