import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_DESK_PASSWORD,
  deskPassword,
  isValidPassword,
  isValidSession,
  sessionToken,
} from "./desk-auth";

test("default desk password is Harangala@13", () => {
  const previousPassword = process.env.ADMIN_PASSWORD;
  const previousSecret = process.env.ADMIN_SESSION_SECRET;
  delete process.env.ADMIN_PASSWORD;
  delete process.env.ADMIN_SESSION_SECRET;
  try {
    assert.equal(DEFAULT_DESK_PASSWORD, "Harangala@13");
    assert.equal(deskPassword(), "Harangala@13");
    assert.equal(isValidPassword("Harangala@13"), true);
    assert.equal(isValidPassword("wrong"), false);
  } finally {
    if (previousPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = previousPassword;
    if (previousSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = previousSecret;
  }
});

test("session token only matches the signed cookie value", () => {
  assert.equal(isValidSession(sessionToken()), true);
  assert.equal(isValidSession("not-a-session"), false);
  assert.equal(isValidSession(undefined), false);
});
