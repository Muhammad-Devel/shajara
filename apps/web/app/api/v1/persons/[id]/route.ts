import { parsePersonPatch, validateParentChildDates, type PersonInput } from "@shajara/genealogy";
import { prisma } from "@shajara/database";
import { ApiError, assertSameOrigin, handle, ok, readJson } from "@/lib/api";
import { audit } from "@/lib/audit";
import { assertCanModifyPerson, birthYearOf, loadFamilyData, personDto, requirePerson, toLite } from "@/lib/families";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const { user } = await requireSession();
  const { person, role } = await requirePerson(user.id, id);
  return ok({ person: personDto(person), role });
});

export const PATCH = handle<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  const { id } = await params;
  const { user } = await requireSession();
  const { person, role } = await requirePerson(user.id, id);
  assertCanModifyPerson(role, user.id, person);

  const existing: PersonInput = {
    firstName: person.firstName, lastName: person.lastName, maidenName: person.maidenName, gender: person.gender,
    birthDate: person.birthDate, deathDate: person.deathDate, isLiving: person.isLiving, bio: person.bio, visibility: person.visibility,
  };
  const parsed = parsePersonPatch(await readJson(req), existing);
  if (!parsed.ok) throw new ApiError(422, "VALIDATION_ERROR", "Invalid input", parsed.errors);

  // New dates must stay consistent with every existing parent/child link of this person.
  const data = await loadFamilyData(prisma, person.familyId);
  const byId = new Map(data.persons.map((p) => [p.id, toLite(p)]));
  const me = { id: person.id, birthDate: parsed.value.birthDate, deathDate: parsed.value.deathDate };
  for (const e of data.parentChild) {
    if (e.parentId !== id && e.childId !== id) continue;
    const parent = e.parentId === id ? me : byId.get(e.parentId);
    const child = e.childId === id ? me : byId.get(e.childId);
    if (!parent || !child) continue;
    const check = validateParentChildDates(parent, child);
    if (!check.ok) throw new ApiError(422, check.code, check.message);
  }

  const updated = await prisma.person.update({
    where: { id },
    data: { ...parsed.value, birthYear: birthYearOf(parsed.value.birthDate) },
  });
  await audit({ actorId: user.id, action: "person.updated", entity: "Person", entityId: id, familyId: person.familyId });
  return ok({ person: personDto(updated) });
});

export const DELETE = handle<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  const { id } = await params;
  const { user } = await requireSession();
  const { person, role } = await requirePerson(user.id, id);
  assertCanModifyPerson(role, user.id, person);
  if (person.userId) {
    throw new ApiError(422, "CANNOT_DELETE_ACCOUNT_PERSON", "A person linked to an account cannot be deleted");
  }
  await prisma.person.update({ where: { id }, data: { deletedAt: new Date() } });
  await audit({ actorId: user.id, action: "person.deleted", entity: "Person", entityId: id, familyId: person.familyId });
  return ok({});
});
