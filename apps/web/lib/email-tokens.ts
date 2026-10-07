import { generateToken, hashToken } from "@shajara/auth";
import { prisma, type EmailTokenType } from "@shajara/database";
import { authSecret, siteUrl } from "./env";
import { sendMail } from "./mailer";

const TTL_MS: Record<EmailTokenType, number> = {
  VERIFY_EMAIL: 24 * 3_600_000,
  RESET_PASSWORD: 3_600_000,
};

export async function issueEmailToken(userId: string, email: string, type: EmailTokenType): Promise<void> {
  const token = generateToken();
  // Only the newest token per type is valid.
  await prisma.emailToken.deleteMany({ where: { userId, type, usedAt: null } });
  await prisma.emailToken.create({
    data: { userId, type, tokenHash: hashToken(token, authSecret()), expiresAt: new Date(Date.now() + TTL_MS[type]) },
  });
  const path = type === "VERIFY_EMAIL" ? "verify-email" : "reset-password";
  const link = `${siteUrl()}/${path}?token=${token}`;
  await sendMail(
    type === "VERIFY_EMAIL"
      ? { to: email, subject: "SHAJARA: emailingizni tasdiqlang", text: `Emailni tasdiqlash uchun havola (24 soat amal qiladi):\n${link}` }
      : { to: email, subject: "SHAJARA: parolni tiklash", text: `Parolni tiklash uchun havola (1 soat amal qiladi):\n${link}\nAgar siz so‘ramagan bo‘lsangiz, bu xatni e’tiborsiz qoldiring.` },
  );
}

/** Single-use: marks the token used atomically and returns the owner, or null if invalid/expired/used. */
export async function consumeEmailToken(token: string, type: EmailTokenType): Promise<string | null> {
  const row = await prisma.emailToken.findUnique({ where: { tokenHash: hashToken(token, authSecret()) } });
  if (!row || row.type !== type || row.usedAt || row.expiresAt <= new Date()) return null;
  const claimed = await prisma.emailToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  return claimed.count === 1 ? row.userId : null;
}
