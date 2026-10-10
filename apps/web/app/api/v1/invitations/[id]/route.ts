import { canGrantRole } from "@shajara/access";
import { prisma } from "@shajara/database";
import { ApiError, assertSameOrigin, handle, ok } from "@/lib/api";
import { audit } from "@/lib/audit";
import { assertCan, requireMembership } from "@/lib/families";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = handle<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  const { id } = await params;
  const { user } = await requireSession();
  const inv = await prisma.invitation.findUnique({ where: { id } });
  if (!inv) throw new ApiError(404, "INVITE_NOT_FOUND", "Invitation not found");

  const { role } = await requireMembership(user.id, inv.familyId);
  assertCan(role, "member:manage");
  if (!canGrantRole(role, inv.role)) throw new ApiError(403, "FORBIDDEN", "You do not have permission to do this");

  await prisma.invitation.updateMany({ where: { id, status: "PENDING" }, data: { status: "REVOKED" } });
  await audit({ actorId: user.id, action: "member.invitation_revoked", entity: "Invitation", entityId: id, familyId: inv.familyId });
  return ok({});
});
