import { assertSameOrigin, handle, ok } from "@/lib/api";
import { audit } from "@/lib/audit";
import { clearSessionCookie, requireSession, revokeAllSessions } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = handle(async (req) => {
  assertSameOrigin(req);
  const { user } = await requireSession();
  await revokeAllSessions(user.id);
  await clearSessionCookie();
  await audit({ actorId: user.id, action: "user.logged_out_everywhere", entity: "User", entityId: user.id });
  return ok({});
});
