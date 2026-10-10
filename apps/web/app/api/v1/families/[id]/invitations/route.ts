import {
  INVITATION_TTL_DAYS, MAX_PENDING_INVITATIONS, canGrantRole,
} from "@shajara/access";
import { generateToken, hashToken } from "@shajara/auth";
import { parseInvitationInput } from "@shajara/genealogy";
import { prisma } from "@shajara/database";
import { ApiError, assertSameOrigin, enforceRateLimit, handle, ok, readJson } from "@/lib/api";
import { audit } from "@/lib/audit";
import { authSecret, siteUrl } from "@/lib/env";
import { assertCan, canSee, requireMembership } from "@/lib/families";
import { sendMail } from "@/lib/mailer";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };
const DAY_MS = 86_400_000;

/** Pending invitations of a family (admins and the owner only). */
export const GET = handle<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const { user } = await requireSession();
  const { role } = await requireMembership(user.id, id);
  assertCan(role, "member:manage");

  const invitations = await prisma.invitation.findMany({
    where: { familyId: id, status: "PENDING", expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  return ok({
    invitations: invitations.map((i) => ({ id: i.id, role: i.role, email: i.email, personId: i.personId, createdAt: i.createdAt, expiresAt: i.expiresAt })),
  });
});

/** Creates an invitation. The plain link is returned once; only its HMAC is stored. */
export const POST = handle<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  const { id } = await params;
  const { user } = await requireSession();
  await enforceRateLimit(`invite-create:${user.id}`, 30, 3_600_000);

  const { role: myRole, family } = await requireMembership(user.id, id);
  assertCan(myRole, "member:manage");

  const parsed = parseInvitationInput(await readJson(req));
  if (!parsed.ok) throw new ApiError(422, "VALIDATION_ERROR", "Invalid input", parsed.errors);
  const { role, email, personId } = parsed.value;

  if (!canGrantRole(myRole, role)) throw new ApiError(403, "FORBIDDEN", "You do not have permission to grant this role");
  if (role === "ADMIN" && !email) {
    throw new ApiError(422, "ADMIN_REQUIRES_EMAIL", "An admin invitation must be bound to an email address");
  }

  const pending = await prisma.invitation.count({ where: { familyId: id, status: "PENDING", expiresAt: { gt: new Date() } } });
  if (pending >= MAX_PENDING_INVITATIONS) throw new ApiError(422, "INVITE_LIMIT", "Too many pending invitations");

  if (personId) {
    const person = await prisma.person.findFirst({ where: { id: personId, familyId: id, deletedAt: null } });
    if (!person || !canSee({ role: myRole, userId: user.id }, person)) throw new ApiError(404, "PERSON_NOT_FOUND", "Person not found");
    if (person.userId) throw new ApiError(422, "PERSON_HAS_ACCOUNT", "This person is already linked to an account");
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * DAY_MS);
  const invitation = await prisma.invitation.create({
    data: { familyId: id, invitedById: user.id, email, personId, role, tokenHash: hashToken(token, authSecret()), expiresAt },
  });

  const link = `${siteUrl()}/invite/${token}`;
  if (email) {
    const inviter = user.profile ? `${user.profile.firstName} ${user.profile.lastName}` : "Oila a’zosi";
    await sendMail({
      to: email,
      subject: `SHAJARA: ${inviter} sizni “${family.name}” oilasiga taklif qildi`,
      text: `${inviter} sizni SHAJARA'dagi “${family.name}” oilasiga taklif qildi.\nQo‘shilish uchun havola (${INVITATION_TTL_DAYS} kun amal qiladi):\n${link}\n\nBu havola faqat shu email manzil uchun.`,
    });
  }
  await audit({ actorId: user.id, action: "member.invited", entity: "Invitation", entityId: invitation.id, familyId: id, meta: { role, emailBound: email !== null } });
  return ok({ invitation: { id: invitation.id, role, email, personId, expiresAt }, link }, 201);
});
