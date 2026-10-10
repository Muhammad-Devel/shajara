import { invitationUsable } from "@shajara/access";
import { hashToken } from "@shajara/auth";
import { prisma } from "@shajara/database";
import { authSecret } from "./env";

/** Looks an invitation up by its plain token. Returns null for unknown, used, revoked, expired or deleted-family invites. */
export async function findUsableInvitation(token: string) {
  if (token.length < 20 || token.length > 200) return null;
  const inv = await prisma.invitation.findUnique({
    where: { tokenHash: hashToken(token, authSecret()) },
    include: { family: true, invitedBy: { include: { profile: true } } },
  });
  if (!inv || inv.family.deletedAt || !invitationUsable(inv, new Date())) return null;
  return inv;
}

export async function invitedPerson(inv: { personId: string | null; familyId: string }) {
  if (!inv.personId) return null;
  return prisma.person.findFirst({ where: { id: inv.personId, familyId: inv.familyId, deletedAt: null, userId: null } });
}
