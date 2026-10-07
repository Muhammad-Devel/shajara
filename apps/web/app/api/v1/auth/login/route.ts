import { dummyHash, hashPassword, needsRehash, parseLogin, verifyPassword } from "@shajara/auth";
import { prisma } from "@shajara/database";
import { ApiError, assertSameOrigin, clientIp, enforceRateLimit, handle, ok, readJson } from "@/lib/api";
import { audit } from "@/lib/audit";
import { createSession } from "@/lib/session";
import { publicUser } from "@/lib/user-dto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = handle(async (req) => {
  assertSameOrigin(req);
  const parsed = parseLogin(await readJson(req));
  if (!parsed.ok) throw new ApiError(422, "VALIDATION_ERROR", "Invalid input", parsed.errors);
  const { email, password } = parsed.value;

  await enforceRateLimit(`login:ip:${clientIp(req)}`, 30, 15 * 60_000);
  await enforceRateLimit(`login:email:${email}`, 8, 15 * 60_000);

  const user = await prisma.user.findUnique({ where: { email }, include: { profile: true } });
  // Always run one password verification so timing does not reveal whether the account exists.
  const valid = await verifyPassword(password, user?.passwordHash ?? (await dummyHash()));
  if (!user || !user.passwordHash || !valid || user.status !== "ACTIVE") {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
  }

  if (needsRehash(user.passwordHash)) {
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password) } });
  }
  await createSession(user.id, req);
  await audit({ actorId: user.id, action: "user.logged_in", entity: "User", entityId: user.id });
  return ok({ user: publicUser(user) });
});
