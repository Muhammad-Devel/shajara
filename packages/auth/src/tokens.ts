import { createHmac, randomBytes } from "node:crypto";

/** Opaque, URL-safe random token (256 bits by default). Give this to the client; store only `hashToken(...)`. */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** HMAC-SHA256 with a server secret (pepper). A leaked database alone cannot be used to forge valid tokens. */
export function hashToken(token: string, secret: string): string {
  return createHmac("sha256", secret).update(token).digest("hex");
}
