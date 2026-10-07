import { generateToken, hashToken } from "@shajara/auth";
import { prisma } from "@shajara/database";
import { cookies } from "next/headers";
import { ApiError, clientIp } from "./api";
import { authSecret } from "./env";

export const SESSION_COOKIE = "shajara_session";
const SESSION_DAYS = 30;
const DAY_MS = 86_400_000;

async function setSessionCookie(token: string, expires: Date): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Creates an opaque session (only its HMAC is stored) and sets the httpOnly cookie. */
export async function createSession(userId: string, req: Request): Promise<void> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * DAY_MS);
  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token, authSecret()),
      userAgent: req.headers.get("user-agent")?.slice(0, 255) ?? null,
      ip: clientIp(req),
      expiresAt,
    },
  });
  await setSessionCookie(token, expiresAt);
}

export async function getCurrentSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token, authSecret()) },
    include: { user: { include: { profile: true } } },
  });
  if (!session || session.revokedAt || session.expiresAt <= new Date() || session.user.status !== "ACTIVE") return null;
  return { session, user: session.user };
}

export async function requireSession() {
  const current = await getCurrentSession();
  if (!current) throw new ApiError(401, "UNAUTHENTICATED", "Authentication required");
  return current;
}

/** Rotation: issues a new token, revokes the old one, extends the expiry. */
export async function rotateSession(req: Request): Promise<void> {
  const { session } = await requireSession();
  await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
  await createSession(session.userId, req);
}

export async function revokeCurrentSession(): Promise<void> {
  const current = await getCurrentSession();
  if (current) await prisma.session.update({ where: { id: current.session.id }, data: { revokedAt: new Date() } });
  await clearSessionCookie();
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}
