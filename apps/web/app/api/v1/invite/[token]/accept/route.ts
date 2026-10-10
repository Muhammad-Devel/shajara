import { MAX_MEMBERS_PER_FAMILY, invitationUsable } from "@shajara/access";
import { hashToken } from "@shajara/auth";
import { prisma } from "@shajara/database";
import { ApiError, assertSameOrigin, enforceRateLimit, handle, ok } from "@/lib/api";
import { audit } from "@/lib/audit";
import { authSecret } from "@/lib/env";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ token: string }> };

export const POST = handle<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  const { token } = await params;
  const { user } = await requireSession();
  await enforceRateLimit(`invite-accept:${user.id}`, 20, 3_600_000);
  if (token.length < 20 || token.length > 200) throw new ApiError(404, "INVITE_INVALID", "The invitation is invalid or has expired");

  const result = await prisma.$transaction(async (tx) => {
    const inv = await tx.invitation.findUnique({ where: { tokenHash: hashToken(token, authSecret()) }, include: { family: true } });
    if (!inv || inv.family.deletedAt || !invitationUsable(inv, new Date())) {
      throw new ApiError(404, "INVITE_INVALID", "The invitation is invalid or has expired");
    }
    // An invitation bound to an email can only be used by the verified owner of that email.
    if (inv.email) {
      if (user.email !== inv.email) throw new ApiError(403, "INVITE_EMAIL_MISMATCH", "This invitation was sent to a different email address");
      if (!user.emailVerified) throw new ApiError(403, "INVITE_EMAIL_UNVERIFIED", "Verify your email address first");
    }
    const existing = await tx.familyMember.findUnique({ where: { familyId_userId: { familyId: inv.familyId, userId: user.id } } });
    if (existing) throw new ApiError(409, "ALREADY_MEMBER", "You are already a member of this family");
    const members = await tx.familyMember.count({ where: { familyId: inv.familyId } });
    if (members >= MAX_MEMBERS_PER_FAMILY) throw new ApiError(422, "MEMBER_LIMIT", "This family has reached its member limit");

    // Single use: only one request can flip PENDING → ACCEPTED.
    const claimed = await tx.invitation.updateMany({ where: { id: inv.id, status: "PENDING" }, data: { status: "ACCEPTED" } });
    if (claimed.count !== 1) throw new ApiError(404, "INVITE_INVALID", "The invitation is invalid or has expired");

    await tx.familyMember.create({ data: { familyId: inv.familyId, userId: user.id, role: inv.role } });

    // Link the account to the tree person it was meant for (only if both sides are still free).
    let linkedPersonId: string | null = null;
    if (inv.personId) {
      const person = await tx.person.findFirst({ where: { id: inv.personId, familyId: inv.familyId, deletedAt: null, userId: null } });
      const mine = await tx.person.findFirst({ where: { familyId: inv.familyId, userId: user.id } });
      if (person && !mine) {
        await tx.person.update({ where: { id: person.id }, data: { userId: user.id } });
        linkedPersonId = person.id;
      }
    }
    return { familyId: inv.familyId, role: inv.role, linkedPersonId };
  });

  await audit({
    actorId: user.id, action: "member.joined", entity: "Family", entityId: result.familyId, familyId: result.familyId,
    meta: { role: result.role, linkedToPerson: result.linkedPersonId !== null },
  });
  return ok({ familyId: result.familyId, linkedPersonId: result.linkedPersonId });
});
