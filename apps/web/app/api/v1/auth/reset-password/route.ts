import { hashPassword, parseResetPassword } from "@shajara/auth";
import { prisma } from "@shajara/database";
import { ApiError, assertSameOrigin, clientIp, enforceRateLimit, handle, ok, readJson } from "@/lib/api";
import { audit } from "@/lib/audit";
import { consumeEmailToken } from "@/lib/email-tokens";
import { revokeAllSessions } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = handle(async (req) => {
  assertSameOrigin(req);
  await enforceRateLimit(`reset:ip:${clientIp(req)}`, 10, 3_600_000);
  const parsed = parseResetPassword(await readJson(req));
  if (!parsed.ok) throw new ApiError(422, "VALIDATION_ERROR", "Invalid input", parsed.errors);

  const userId = await consumeEmailToken(parsed.value.token, "RESET_PASSWORD");
  if (!userId) throw new ApiError(400, "INVALID_TOKEN", "The link is invalid or has expired");

  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(parsed.value.password) } });
  await revokeAllSessions(userId); // a password reset signs out every device
  await audit({ actorId: userId, action: "user.password_reset", entity: "User", entityId: userId });
  return ok({});
});
