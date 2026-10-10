import { INVITABLE_ROLES, canChangeRole, canRemoveMember } from "@shajara/access";
import { prisma } from "@shajara/database";
import { ApiError, assertSameOrigin, handle, ok, readJson } from "@/lib/api";
import { audit } from "@/lib/audit";
import { assertCan, requireMembership } from "@/lib/families";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; userId: string }> };

export const PATCH = handle<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  const { id, userId } = await params;
  const { user } = await requireSession();
  const { role: myRole } = await requireMembership(user.id, id);
  assertCan(myRole, "member:manage");

  const body = await readJson(req);
  const newRole = typeof body === "object" && body !== null ? (body as Record<string, unknown>).role : undefined;
  if (typeof newRole !== "string" || !(INVITABLE_ROLES as readonly string[]).includes(newRole)) {
    throw new ApiError(422, "VALIDATION_ERROR", "Invalid input", { role: "ROLE_INVALID" });
  }
  if (userId === user.id) throw new ApiError(422, "CANNOT_CHANGE_SELF", "You cannot change your own role");

  const target = await prisma.familyMember.findUnique({ where: { familyId_userId: { familyId: id, userId } } });
  if (!target) throw new ApiError(404, "MEMBER_NOT_FOUND", "Member not found");
  const next = newRole as (typeof INVITABLE_ROLES)[number];
  if (!canChangeRole(myRole, target.role, next)) throw new ApiError(403, "FORBIDDEN", "You do not have permission to do this");

  await prisma.familyMember.update({ where: { familyId_userId: { familyId: id, userId } }, data: { role: next } });
  await audit({ actorId: user.id, action: "permission.changed", entity: "FamilyMember", entityId: userId, familyId: id, meta: { from: target.role, to: next } });
  return ok({ member: { userId, role: next } });
});

/** Removes a member (or lets them leave). The family's people and their data stay; the account link is cleared. */
export const DELETE = handle<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  const { id, userId } = await params;
  const { user } = await requireSession();
  const { role: myRole } = await requireMembership(user.id, id);

  const target = await prisma.familyMember.findUnique({ where: { familyId_userId: { familyId: id, userId } } });
  if (!target) throw new ApiError(404, "MEMBER_NOT_FOUND", "Member not found");
  if (!canRemoveMember({ actor: myRole, actorId: user.id, target: target.role, targetId: userId })) {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission to do this");
  }

  await prisma.$transaction([
    prisma.person.updateMany({ where: { familyId: id, userId }, data: { userId: null } }),
    prisma.familyMember.delete({ where: { familyId_userId: { familyId: id, userId } } }),
  ]);
  await audit({
    actorId: user.id, action: userId === user.id ? "member.left" : "member.removed", entity: "FamilyMember", entityId: userId, familyId: id,
  });
  return ok({});
});
