import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/** scrypt parameters (memory ≈ 128 * N * r bytes = 64 MiB). Stored inside every hash, so they can be raised later. */
const PARAMS = { N: 2 ** 16, r: 8, p: 1 } as const;
const KEY_LEN = 64;
const SALT_LEN = 16;
const MAX_MEM = 256 * 1024 * 1024;

function derive(password: string, salt: Buffer, N: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, KEY_LEN, { N, r, p, maxmem: MAX_MEM }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

/** Format: scrypt$N$r$p$<salt b64>$<hash b64> */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const key = await derive(password, salt, PARAMS.N, PARAMS.r, PARAMS.p);
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64"), key.toString("base64")].join("$");
}

interface Parsed { N: number; r: number; p: number; salt: Buffer; key: Buffer }

function parse(stored: string): Parsed | null {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return null;
  const [N, r, p] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
  if (![N, r, p].every((n) => Number.isInteger(n) && n > 0)) return null;
  if (N > 2 ** 20 || r > 32 || p > 8) return null; // refuse absurd params from a tampered value
  const salt = Buffer.from(parts[4] ?? "", "base64");
  const key = Buffer.from(parts[5] ?? "", "base64");
  if (salt.length === 0 || key.length !== KEY_LEN) return null;
  return { N, r, p, salt, key };
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parse(stored);
  if (!parsed) return false;
  const key = await derive(password, parsed.salt, parsed.N, parsed.r, parsed.p);
  return key.length === parsed.key.length && timingSafeEqual(key, parsed.key);
}

/** True when the stored hash uses weaker parameters than the current ones (rehash after a successful login). */
export function needsRehash(stored: string): boolean {
  const parsed = parse(stored);
  return !parsed || parsed.N !== PARAMS.N || parsed.r !== PARAMS.r || parsed.p !== PARAMS.p;
}

let dummy: Promise<string> | undefined;
/** A valid hash to verify against when the user does not exist, so response time does not reveal account existence. */
export function dummyHash(): Promise<string> {
  dummy ??= hashPassword("shajara-timing-equalizer");
  return dummy;
}
