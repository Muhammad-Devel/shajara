import { prisma } from "@shajara/database";
import { ApiError, assertSameOrigin, handle, ok } from "@/lib/api";
import { audit } from "@/lib/audit";
import { assertCan, canSee, requireMembership } from "@/lib/families";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = handle<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  const { id } = await params;
  const { user } = await requireSession();
  const m = await prisma.marriage.findUnique({ where: { id }, include: { personA: true, personB: true } });
  if (!m || m.personA.deletedAt || m.personB.deletedAt) throw new ApiError(404, "RELATION_NOT_FOUND", "Relationship not found");

  const { role } = await requireMembership(user.id, m.familyId);
  assertCan(role, "relation:manage");
  const viewer = { role, userId: user.id };
  if (!canSee(viewer, m.personA) || !canSee(viewer, m.personB)) throw new ApiError(404, "RELATION_NOT_FOUND", "Relationship not found");

  await prisma.marriage.delete({ where: { id } });
  await audit({ actorId: user.id, action: "relationship.deleted", entity: "Marriage", entityId: id, familyId: m.familyId });
  return ok({});
});
