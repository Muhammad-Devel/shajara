import { assertSameOrigin, handle, ok } from "@/lib/api";
import { revokeCurrentSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = handle(async (req) => {
  assertSameOrigin(req);
  await revokeCurrentSession();
  return ok({});
});
