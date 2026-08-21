export const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

export const BROWSER_NAVIGATE_HEADERS = {
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-GB,en;q=0.9",
  "User-Agent": BROWSER_USER_AGENT,
  "Upgrade-Insecure-Requests": "1",
};

export function isCloudflareChallenge(html: string): boolean {
  return /just a moment|cf-challenge|cf-browser-verification|attention required/i.test(
    html,
  );
}

export function parseIncludedHttpResponse(raw: string): {
  status: number;
  html: string;
  cookies: string;
} | null {
  const normalized = raw.replace(/\r\n/g, "\n");
  const statusLine = /^HTTP\/\d(?:\.\d)?\s+(\d{3})[^\n]*\n/gm;
  let last: { index: number; status: number } | null = null;
  let match: RegExpExecArray | null;
  while ((match = statusLine.exec(normalized))) {
    last = { index: match.index, status: Number(match[1]) };
  }
  if (!last) return null;

  const fromHeaders = normalized.slice(last.index);
  const split = fromHeaders.indexOf("\n\n");
  const headerBlock = split === -1 ? fromHeaders : fromHeaders.slice(0, split);
  const html = split === -1 ? "" : fromHeaders.slice(split + 2);
  const cookies = [...headerBlock.matchAll(/^set-cookie:\s*([^;\n]+)/gim)]
    .map((item) => item[1]?.trim())
    .filter((value): value is string => Boolean(value))
    .join("; ");

  return { status: last.status, html, cookies };
}

export function isUsableHtmlDocument(status: number, html: string): boolean {
  return status >= 200 && status < 400 && !isCloudflareChallenge(html);
}
