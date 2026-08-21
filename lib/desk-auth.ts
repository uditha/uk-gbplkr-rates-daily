import { createHmac, timingSafeEqual } from "node:crypto";

export const DESK_COOKIE = "desk_session";
export const DEFAULT_DESK_PASSWORD = "Harangala@13";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export function deskPassword() {
  return process.env.ADMIN_PASSWORD || DEFAULT_DESK_PASSWORD;
}

function sessionSecret() {
  return process.env.ADMIN_SESSION_SECRET || deskPassword();
}

export function sessionToken() {
  return createHmac("sha256", sessionSecret()).update("desk-ok").digest("hex");
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function isValidPassword(password: string) {
  return safeEqual(password, deskPassword());
}

export function isValidSession(token: string | undefined) {
  if (!token) return false;
  return safeEqual(token, sessionToken());
}

export function deskCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  };
}
