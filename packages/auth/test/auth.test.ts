import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkPassword, dummyHash, generateToken, hashPassword, hashToken, needsRehash,
  parseLogin, parseRegister, parseResetPassword, verifyPassword,
} from "../src/index.ts";

describe("password hashing", () => {
  it("verifies the right password and rejects a wrong one", async () => {
    const h = await hashPassword("correct horse battery");
    assert.match(h, /^scrypt\$65536\$8\$1\$/);
    assert.equal(await verifyPassword("correct horse battery", h), true);
    assert.equal(await verifyPassword("correct horse batterz", h), false);
  });
  it("uses a fresh salt every time", async () => {
    assert.notEqual(await hashPassword("same-password-1"), await hashPassword("same-password-1"));
  });
  it("rejects malformed or tampered hashes without throwing", async () => {
    assert.equal(await verifyPassword("x", "garbage"), false);
    assert.equal(await verifyPassword("x", "scrypt$99999999$8$1$AAAA$AAAA"), false);
    assert.equal(await verifyPassword("x", ""), false);
  });
  it("needsRehash flags weaker parameters", async () => {
    assert.equal(needsRehash(await hashPassword("whatever-long-1")), false);
    assert.equal(needsRehash("scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" + Buffer.alloc(64).toString("base64")), true);
    assert.equal(needsRehash("junk"), true);
  });
  it("dummy hash is a valid hash", async () => {
    assert.equal(await verifyPassword("nope", await dummyHash()), false);
  });
});

describe("tokens", () => {
  it("are unique and URL-safe", () => {
    const a = generateToken(), b = generateToken();
    assert.notEqual(a, b);
    assert.match(a, /^[A-Za-z0-9_-]{43}$/);
  });
  it("hash is deterministic per secret and differs across secrets", () => {
    const t = generateToken();
    assert.equal(hashToken(t, "s".repeat(32)), hashToken(t, "s".repeat(32)));
    assert.notEqual(hashToken(t, "s".repeat(32)), hashToken(t, "x".repeat(32)));
    assert.notEqual(hashToken(t, "s".repeat(32)), t);
  });
});

describe("validators", () => {
  const good = { email: "  Ali@Example.COM ", password: "a-decent-pass-1", firstName: " Ali ", lastName: "Valiyev" };
  it("normalizes a valid registration", () => {
    const r = parseRegister(good);
    assert.equal(r.ok, true);
    if (r.ok) assert.deepEqual(r.value, { email: "ali@example.com", password: "a-decent-pass-1", firstName: "Ali", lastName: "Valiyev" });
  });
  it("reports field-level error codes", () => {
    const r = parseRegister({ email: "nope", password: "short", firstName: "", lastName: "x".repeat(81) });
    assert.equal(r.ok, false);
    if (!r.ok) assert.deepEqual(r.errors, {
      email: "EMAIL_INVALID", password: "PASSWORD_TOO_SHORT", firstName: "NAME_INVALID", lastName: "NAME_INVALID",
    });
  });
  it("password policy", () => {
    assert.equal(checkPassword("1234567890"), "PASSWORD_TOO_COMMON");
    assert.equal(checkPassword("aaaaaaaaaaaa"), "PASSWORD_TOO_COMMON");
    assert.equal(checkPassword("x".repeat(129)), "PASSWORD_TOO_LONG");
    assert.equal(checkPassword("uzbekistan-2026"), null);
  });
  it("rejects non-object bodies", () => {
    assert.equal(parseRegister("hello").ok, false);
    assert.equal(parseLogin(null).ok, false);
    assert.equal(parseLogin([]).ok, false);
  });
  it("login does not enforce password policy", () => {
    assert.equal(parseLogin({ email: "a@b.co", password: "x" }).ok, true);
  });
  it("reset requires a plausible token and a valid password", () => {
    assert.equal(parseResetPassword({ token: "short", password: "a-decent-pass-1" }).ok, false);
    assert.equal(parseResetPassword({ token: "t".repeat(43), password: "a-decent-pass-1" }).ok, true);
  });
});
