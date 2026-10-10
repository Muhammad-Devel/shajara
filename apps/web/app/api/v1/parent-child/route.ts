import { parseParentChildInput, validateParentChild } from "@shajara/genealogy";
import { prisma } from "@shajara/database";
import { ApiError, assertSameOrigin, enforceRateLimit, handle, ok, readJson } from "@/lib/api";
import { audit } from "@/lib/audit";
import {
  assertCan, buildGraph, canSee, loadFamilyData, personMap, requireMembership, validationToApiError, withSerializable,
} from "@/lib/families";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BIOLOGICAL_PARENTS = 2;

export const POST = handle(async (req) => {
  assertSameOrigin(req);
  const { user } = await requireSession();
  await enforceRateLimit(`relation-create:${user.id}`, 600, 3_600_000);

  const parsed = parseParentChildInput(await readJson(req));
  if (!parsed.ok) throw new ApiError(422, "VALIDATION_ERROR", "Invalid input", parsed.errors);
  const { parentId, childId, type } = parsed.value;

  const [parent, child] = await Promise.all([
    prisma.person.findFirst({ where: { id: parentId, deletedAt: null } }),
    prisma.person.findFirst({ where: { id: childId, deletedAt: null } }),
  ]);
  if (!parent || !child) throw new ApiError(404, "PERSON_NOT_FOUND", "Person not found");
  if (parent.familyId !== child.familyId) throw new ApiError(422, "DIFFERENT_FAMILIES", "People belong to different families");

  const { role } = await requireMembership(user.id, parent.familyId);
  assertCan(role, "relation:manage");
  const viewer = { role, userId: user.id };
  if (!canSee(viewer, parent) || !canSee(viewer, child)) throw new ApiError(404, "PERSON_NOT_FOUND", "Person not found");

  const relation = await withSerializable(async (tx) => {
    const data = await loadFamilyData(tx, parent.familyId);
    const check = validateParentChild(buildGraph(data), personMap(data.persons), { parentId, childId });
    if (!check.ok) throw validationToApiError(check);
    if (type === "BIOLOGICAL") {
      const bio = data.parentChild.filter((e) => e.childId === childId && e.type === "BIOLOGICAL").length;
      if (bio >= MAX_BIOLOGICAL_PARENTS) throw new ApiError(422, "TOO_MANY_PARENTS", "A person has at most two biological parents");
    }
    return tx.parentChild.create({ data: { familyId: parent.familyId, parentId, childId, type } });
  });

  await audit({ actorId: user.id, action: "relationship.created", entity: "ParentChild", entityId: relation.id, familyId: parent.familyId });
  return ok({ relation: { id: relation.id, parentId, childId, type } }, 201);
});
