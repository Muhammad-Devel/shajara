import { assertSameOrigin, enforceRateLimit, handle, ok } from "@/lib/api";
import { issueEmailToken } from "@/lib/email-tokens";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = handle(async (req) => {
  assertSameOrigin(req);
  const { user } = await requireSession();
  if (user.emailVerified) return ok({ alreadyVerified: true });
  await enforceRateLimit(`resend-verify:user:${user.id}`, 3, 3_600_000);
  await issueEmailToken(user.id, user.email, "VERIFY_EMAIL");
  return ok({ sent: true });
});
