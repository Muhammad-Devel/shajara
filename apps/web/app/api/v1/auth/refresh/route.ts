import { assertSameOrigin, handle, ok } from "@/lib/api";
import { rotateSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Session rotation: new token + extended expiry, old token revoked. */
export const POST = handle(async (req) => {
  assertSameOrigin(req);
  await rotateSession(req);
  return ok({});
});
