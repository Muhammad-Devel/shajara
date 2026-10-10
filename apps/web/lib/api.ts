import { prisma } from "@shajara/database";

/** Consistent API envelope: { success, data, error }. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function ok<T>(data: T, status = 200): Response {
  return Response.json({ success: true, data, error: null }, { status });
}

function fail(status: number, code: string, message: string, details?: unknown, headers?: HeadersInit): Response {
  return Response.json(
    { success: false, data: null, error: { code, message, ...(details === undefined ? {} : { details }) } },
    { status, headers },
  );
}

/** Wraps a route handler: ApiError → proper envelope; anything else → generic 500 (details only in server logs). */
export function handle<C = unknown>(fn: (req: Request, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C): Promise<Response> => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof ApiError) {
        const headers = err.code === "RATE_LIMITED" && typeof err.details === "number" ? { "Retry-After": String(err.details) } : undefined;
        return fail(err.status, err.code, err.message, err.code === "RATE_LIMITED" ? undefined : err.details, headers);
      }
      console.error("[api] unhandled error", err);
      return fail(500, "INTERNAL_ERROR", "Something went wrong");
    }
  };
}

const MAX_BODY_BYTES = 16 * 1024;

export async function readJson(req: Request): Promise<unknown> {
  if (!(req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json");
  }
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Request body too large");
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, "BAD_JSON", "Request body is not valid JSON");
  }
}

/** CSRF defence in depth (on top of SameSite=Lax cookies): browsers always send Origin on POST. */
export function assertSameOrigin(req: Request): void {
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser client (e.g. future mobile app); it cannot ride a victim's cookies
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ApiError(403, "CSRF_REJECTED", "Cross-origin request rejected");
  }
  if (originHost !== host) throw new ApiError(403, "CSRF_REJECTED", "Cross-origin request rejected");
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

/** Atomic fixed-window counter in Postgres (works across serverless instances). */
export async function enforceRateLimit(key: string, limit: number, windowMs: number): Promise<void> {
  const resetAt = new Date(Date.now() + windowMs);
  const rows = await prisma.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt")
    VALUES (${key}, 1, ${resetAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count"   = CASE WHEN "RateLimitBucket"."resetAt" <= now() THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimitBucket"."resetAt" <= now() THEN ${resetAt} ELSE "RateLimitBucket"."resetAt" END
    RETURNING "count", "resetAt"`;
  const row = rows[0];
  if (row && row.count > limit) {
    const retryAfter = Math.max(1, Math.ceil((new Date(row.resetAt).getTime() - Date.now()) / 1000));
    throw new ApiError(429, "RATE_LIMITED", "Too many attempts. Please try again later.", retryAfter);
  }
}
