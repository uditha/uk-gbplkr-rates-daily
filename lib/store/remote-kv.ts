import { mergeStores } from "./snapshot";
import type { RatesStoreState } from "./types";

export const RATES_KV_KEY = "uk-gbplkr-rates";
export const REFRESH_LOCK_KEY = "uk-gbplkr-rates-refresh-lock";
const REFRESH_LOCK_TTL_SECONDS = 90;

async function sendKvCommand(
  creds: { url: string; token: string },
  command: unknown[],
): Promise<unknown> {
  const response = await fetch(creds.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${creds.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    return null;
  }
  const payload = (await response.json()) as { result?: unknown };
  return payload.result ?? null;
}

function kvCredentials(): { url: string; token: string } | null {
  const url =
    process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL ?? null;
  const token =
    process.env.KV_REST_API_TOKEN ??
    process.env.UPSTASH_REDIS_REST_TOKEN ??
    null;
  if (!url || !token) {
    return null;
  }
  return { url: url.replace(/\/$/, ""), token };
}

export function hasSharedStore(): boolean {
  return kvCredentials() != null;
}

export async function loadRemoteStore(): Promise<RatesStoreState | null> {
  const creds = kvCredentials();
  if (!creds) {
    return null;
  }

  try {
    const response = await fetch(
      `${creds.url}/get/${encodeURIComponent(RATES_KV_KEY)}`,
      {
        headers: { Authorization: `Bearer ${creds.token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as { result?: unknown };
    if (payload.result == null) {
      return null;
    }
    const parsed =
      typeof payload.result === "string"
        ? (JSON.parse(payload.result) as RatesStoreState)
        : (payload.result as RatesStoreState);
    if (!parsed || !Array.isArray(parsed.providers)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function saveRemoteStore(state: RatesStoreState): Promise<boolean> {
  const creds = kvCredentials();
  if (!creds) {
    return false;
  }

  try {
    const existing = await loadRemoteStore();
    const merged = mergeStores(existing, state) ?? state;
    const result = await sendKvCommand(creds, [
      "SET",
      RATES_KV_KEY,
      JSON.stringify(merged),
    ]);
    return result === "OK";
  } catch {
    return false;
  }
}

/** true = this process holds the lock, false = another refresh is running, null = no KV. */
export async function acquireRemoteLock(): Promise<boolean | null> {
  const creds = kvCredentials();
  if (!creds) {
    return null;
  }

  try {
    const result = await sendKvCommand(creds, [
      "SET",
      REFRESH_LOCK_KEY,
      "1",
      "NX",
      "EX",
      REFRESH_LOCK_TTL_SECONDS,
    ]);
    return result === "OK";
  } catch {
    return null;
  }
}

export async function releaseRemoteLock(): Promise<void> {
  const creds = kvCredentials();
  if (!creds) {
    return;
  }

  try {
    await sendKvCommand(creds, ["DEL", REFRESH_LOCK_KEY]);
  } catch {
    // Lock TTL will expire on its own.
  }
}
