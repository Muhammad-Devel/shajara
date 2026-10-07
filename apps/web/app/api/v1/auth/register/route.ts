import { hashPassword, parseRegister } from "@shajara/auth";
import { Prisma, prisma } from "@shajara/database";
import { ApiError, assertSameOrigin, clientIp, enforceRateLimit, handle, ok, readJson } from "@/lib/api";
import { audit } from "@/lib/audit";
import { issueEmailToken } from "@/lib/email-tokens";
import { createSession } from "@/lib/session";
import { publicUser } from "@/lib/user-dto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = handle(async (req) => {
  assertSameOrigin(req);
  await enforceRateLimit(`register:ip:${clientIp(req)}`, 10, 3_600_000);

  const parsed = parseRegister(await readJson(req));
  if (!parsed.ok) throw new ApiError(422, "VALIDATION_ERROR", "Invalid input", parsed.errors);
  const { email, password, firstName, lastName } = parsed.value;

  const passwordHash = await hashPassword(password);
  let user;
  try {
    user = await prisma.user.create({
      data: { email, passwordHash, profile: { create: { firstName, lastName } } },
      include: { profile: true },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new ApiError(409, "EMAIL_TAKEN", "This email is already registered");
    }
    throw err;
  }

  await issueEmailToken(user.id, user.email, "VERIFY_EMAIL");
  await createSession(user.id, req);
  await audit({ actorId: user.id, action: "user.registered", entity: "User", entityId: user.id });
  return ok({ user: publicUser(user) }, 201);
});
