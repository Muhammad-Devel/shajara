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
  const edge = await prisma.parentChild.findUnique({ where: { id }, include: { parent: true, child: true } });
  if (!edge || edge.parent.deletedAt || edge.child.deletedAt) throw new ApiError(404, "RELATION_NOT_FOUND", "Relationship not found");

  const { role } = await requireMembership(user.id, edge.familyId);
  assertCan(role, "relation:manage");
  const viewer = { role, userId: user.id };
  if (!canSee(viewer, edge.parent) || !canSee(viewer, edge.child)) throw new ApiError(404, "RELATION_NOT_FOUND", "Relationship not found");

  await prisma.parentChild.delete({ where: { id } });
  await audit({ actorId: user.id, action: "relationship.deleted", entity: "ParentChild", entityId: id, familyId: edge.familyId });
  return ok({});
});
