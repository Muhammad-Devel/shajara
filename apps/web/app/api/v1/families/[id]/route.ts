import { parseFamilyInput } from "@shajara/genealogy";
import { prisma } from "@shajara/database";
import { ApiError, assertSameOrigin, handle, ok, readJson } from "@/lib/api";
import { audit } from "@/lib/audit";
import { assertCan, requireMembership } from "@/lib/families";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const { user } = await requireSession();
  const { family, role } = await requireMembership(user.id, id);
  const persons = await prisma.person.count({ where: { familyId: id, deletedAt: null } });
  return ok({ family: { id: family.id, name: family.name, description: family.description }, role, stats: { persons } });
});

export const PATCH = handle<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  const { id } = await params;
  const { user } = await requireSession();
  const { family, role } = await requireMembership(user.id, id);
  assertCan(role, "family:update");

  const body = await readJson(req);
  const obj = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const parsed = parseFamilyInput({
    name: "name" in obj ? obj.name : family.name,
    description: "description" in obj ? obj.description : family.description,
  });
  if (!parsed.ok) throw new ApiError(422, "VALIDATION_ERROR", "Invalid input", parsed.errors);

  const updated = await prisma.family.update({ where: { id }, data: parsed.value });
  await audit({ actorId: user.id, action: "family.updated", entity: "Family", entityId: id, familyId: id });
  return ok({ family: { id: updated.id, name: updated.name, description: updated.description } });
});

/** Soft delete (OWNER only). Data export / permanent deletion is a separate privacy feature. */
export const DELETE = handle<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  const { id } = await params;
  const { user } = await requireSession();
  const { role } = await requireMembership(user.id, id);
  assertCan(role, "family:delete");
  await prisma.family.update({ where: { id }, data: { deletedAt: new Date() } });
  await audit({ actorId: user.id, action: "family.deleted", entity: "Family", entityId: id, familyId: id });
  return ok({});
});
