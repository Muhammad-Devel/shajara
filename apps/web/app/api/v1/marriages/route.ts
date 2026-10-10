import { parseMarriageInput, validateMarriage } from "@shajara/genealogy";
import { prisma } from "@shajara/database";
import { ApiError, assertSameOrigin, enforceRateLimit, handle, ok, readJson } from "@/lib/api";
import { audit } from "@/lib/audit";
import {
  assertCan, buildGraph, canSee, loadFamilyData, personMap, requireMembership, validationToApiError, withSerializable,
} from "@/lib/families";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = handle(async (req) => {
  assertSameOrigin(req);
  const { user } = await requireSession();
  await enforceRateLimit(`relation-create:${user.id}`, 600, 3_600_000);

  const parsed = parseMarriageInput(await readJson(req));
  if (!parsed.ok) throw new ApiError(422, "VALIDATION_ERROR", "Invalid input", parsed.errors);
  const { status, startDate, endDate } = parsed.value;
  // Canonical order (A < B) so one pair can exist only once.
  const [personAId, personBId] = [parsed.value.personAId, parsed.value.personBId].sort() as [string, string];

  const [a, b] = await Promise.all([
    prisma.person.findFirst({ where: { id: personAId, deletedAt: null } }),
    prisma.person.findFirst({ where: { id: personBId, deletedAt: null } }),
  ]);
  if (!a || !b) throw new ApiError(404, "PERSON_NOT_FOUND", "Person not found");
  if (a.familyId !== b.familyId) throw new ApiError(422, "DIFFERENT_FAMILIES", "People belong to different families");

  const { role } = await requireMembership(user.id, a.familyId);
  assertCan(role, "relation:manage");
  const viewer = { role, userId: user.id };
  if (!canSee(viewer, a) || !canSee(viewer, b)) throw new ApiError(404, "PERSON_NOT_FOUND", "Person not found");

  const marriage = await withSerializable(async (tx) => {
    const data = await loadFamilyData(tx, a.familyId);
    const check = validateMarriage(buildGraph(data), personMap(data.persons), { personAId, personBId });
    if (!check.ok) throw validationToApiError(check);
    return tx.marriage.create({ data: { familyId: a.familyId, personAId, personBId, status, startDate, endDate } });
  });

  await audit({ actorId: user.id, action: "relationship.created", entity: "Marriage", entityId: marriage.id, familyId: a.familyId });
  return ok({ marriage: { id: marriage.id, personAId, personBId, status, startDate, endDate } }, 201);
});
