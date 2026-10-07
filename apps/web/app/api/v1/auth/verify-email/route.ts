import { parseToken } from "@shajara/auth";
import { prisma } from "@shajara/database";
import { ApiError, assertSameOrigin, clientIp, enforceRateLimit, handle, ok, readJson } from "@/lib/api";
import { audit } from "@/lib/audit";
import { consumeEmailToken } from "@/lib/email-tokens";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = handle(async (req) => {
  assertSameOrigin(req);
  await enforceRateLimit(`verify:ip:${clientIp(req)}`, 20, 3_600_000);
  const parsed = parseToken(await readJson(req));
  if (!parsed.ok) throw new ApiError(422, "VALIDATION_ERROR", "Invalid input", parsed.errors);

  const userId = await consumeEmailToken(parsed.value.token, "VERIFY_EMAIL");
  if (!userId) throw new ApiError(400, "INVALID_TOKEN", "The link is invalid or has expired");

  await prisma.user.update({ where: { id: userId }, data: { emailVerified: new Date() } });
  await audit({ actorId: userId, action: "user.email_verified", entity: "User", entityId: userId });
  return ok({});
});
