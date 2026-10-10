import { can, canModifyPerson, canViewPerson, type Action } from "@shajara/access";
import { Prisma, prisma, type FamilyRole, type Person } from "@shajara/database";
import { FamilyGraph, ValidationCode, type PersonLite, type ValidationResult } from "@shajara/genealogy";
import { ApiError } from "./api";

export type Db = Prisma.TransactionClient;

export async function getMembership(userId: string, familyId: string) {
  const member = await prisma.familyMember.findUnique({
    where: { familyId_userId: { familyId, userId } },
    include: { family: true },
  });
  return member && !member.family.deletedAt ? member : null;
}

/** Non-members get 404 (not 403) so the existence of a family is not revealed. */
export async function requireMembership(userId: string, familyId: string) {
  const member = await getMembership(userId, familyId);
  if (!member) throw new ApiError(404, "FAMILY_NOT_FOUND", "Family not found");
  return member;
}

export function assertCan(role: FamilyRole, action: Action): void {
  if (!can(role, action)) throw new ApiError(403, "FORBIDDEN", "You do not have permission to do this");
}

export function assertCanModifyPerson(role: FamilyRole, userId: string, person: Person): void {
  if (!canModifyPerson(role, userId, person.createdById)) {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission to do this");
  }
}

export function canSee(viewer: { role: FamilyRole; userId: string }, person: Person): boolean {
  return canViewPerson({ role: viewer.role, userId: viewer.userId, visibility: person.visibility, createdById: person.createdById });
}

/** Loads a person the user may see, plus their role. Hidden or foreign persons look like "not found". */
export async function requirePerson(userId: string, personId: string) {
  const person = await prisma.person.findFirst({ where: { id: personId, deletedAt: null } });
  if (!person) throw new ApiError(404, "PERSON_NOT_FOUND", "Person not found");
  const member = await getMembership(userId, person.familyId);
  if (!member || !canSee({ role: member.role, userId }, person)) {
    throw new ApiError(404, "PERSON_NOT_FOUND", "Person not found");
  }
  return { person, role: member.role };
}

export async function loadFamilyData(db: Db, familyId: string) {
  const persons = await db.person.findMany({
    where: { familyId, deletedAt: null },
    orderBy: [{ birthYear: "asc" }, { createdAt: "asc" }],
  });
  const alive = new Set(persons.map((p) => p.id));
  const [edges, marriages] = await Promise.all([
    db.parentChild.findMany({ where: { familyId } }),
    db.marriage.findMany({ where: { familyId } }),
  ]);
  return {
    persons,
    parentChild: edges.filter((e) => alive.has(e.parentId) && alive.has(e.childId)),
    marriages: marriages.filter((m) => alive.has(m.personAId) && alive.has(m.personBId)),
  };
}
export type FamilyData = Awaited<ReturnType<typeof loadFamilyData>>;

export function buildGraph(data: FamilyData): FamilyGraph {
  return new FamilyGraph(
    data.parentChild.map((e) => ({ parentId: e.parentId, childId: e.childId })),
    data.marriages.map((m) => ({ personAId: m.personAId, personBId: m.personBId })),
  );
}

export const toLite = (p: Person): PersonLite => ({ id: p.id, birthDate: p.birthDate, deathDate: p.deathDate });
export const personMap = (persons: Person[]) => new Map(persons.map((p) => [p.id, toLite(p)]));

/** The ONLY shape of a person that leaves the server. */
export function personDto(p: Person) {
  return {
    id: p.id,
    familyId: p.familyId,
    firstName: p.firstName,
    lastName: p.lastName,
    maidenName: p.maidenName,
    gender: p.gender,
    birthDate: p.birthDate,
    deathDate: p.deathDate,
    isLiving: p.isLiving,
    bio: p.bio,
    visibility: p.visibility,
    hasAccount: p.userId !== null,
  };
}

/** Maps an engine validation failure to an HTTP error. */
export function validationToApiError(result: Extract<ValidationResult, { ok: false }>): ApiError {
  const status = result.code === ValidationCode.DuplicateRelationship ? 409 : result.code === ValidationCode.PersonNotFound ? 404 : 422;
  return new ApiError(status, result.code, result.message);
}

/** Relationship changes run serialized so two simultaneous requests cannot create a cycle together. */
export async function withSerializable<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
  try {
    return await prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034") {
      throw new ApiError(409, "CONFLICT", "Concurrent change detected, please retry");
    }
    throw err;
  }
}

export const birthYearOf = (birthDate: string | null): number | null => (birthDate ? Number(birthDate.slice(0, 4)) : null);
