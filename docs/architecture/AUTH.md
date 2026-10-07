# Authentication (Phase 4a)

- **Sessions, not JWT.** Opaque 256-bit token in an httpOnly, Secure, SameSite=Lax cookie. Only `HMAC-SHA256(token, AUTH_SECRET)` is stored (`Session.tokenHash`). Instant revocation; "log out everywhere" = revoke all rows. `/auth/refresh` rotates the token. The same token can be sent as a Bearer token by the mobile app later.
- **Passwords:** scrypt (N=2^16, r=8, p=1), parameters stored in the hash, `needsRehash` upgrades on login. Policy: 10–128 chars, common-password check.
- **Enumeration resistance:** login always verifies against a dummy hash for unknown emails; forgot-password always returns the same answer. Registration returns `EMAIL_TAKEN` (UX trade-off, mitigated by rate limits).
- **Rate limiting:** atomic Postgres upsert (`RateLimitBucket`) — works on serverless. Redis later.
- **CSRF:** SameSite=Lax + Origin check + JSON-only bodies.
- **Reset password:** single-use 1h token; resets sign out all devices.
- **Audit:** register, login, email verified, password reset, logout-all (no secrets in meta).
- **Not yet:** Google OAuth, email delivery provider, account lockout UI → Phase 4b.
