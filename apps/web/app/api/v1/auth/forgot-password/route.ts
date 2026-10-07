import { parseEmailOnly } from "@shajara/auth";
import { prisma } from "@shajara/database";
import { ApiError, assertSameOrigin, clientIp, enforceRateLimit, handle, ok, readJson } from "@/lib/api";
import { issueEmailToken } from "@/lib/email-tokens";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Always answers the same way, so it cannot be used to discover which emails are registered. */
export const POST = handle(async (req) => {
  assertSameOrigin(req);
  const parsed = parseEmailOnly(await readJson(req));
  if (!parsed.ok) throw new ApiError(422, "VALIDATION_ERROR", "Invalid input", parsed.errors);
  const { email } = parsed.value;

  await enforceRateLimit(`forgot:ip:${clientIp(req)}`, 10, 3_600_000);
  await enforceRateLimit(`forgot:email:${email}`, 3, 3_600_000);

  const user = await prisma.user.findUnique({ where: { email } });
  if (user && user.status === "ACTIVE") await issueEmailToken(user.id, user.email, "RESET_PASSWORD");
  return ok({ sent: true });
});
