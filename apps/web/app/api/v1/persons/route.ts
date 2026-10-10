import { parsePersonInput } from "@shajara/genealogy";
import { prisma } from "@shajara/database";
import { ApiError, assertSameOrigin, enforceRateLimit, handle, ok, readJson } from "@/lib/api";
import { audit } from "@/lib/audit";
import { assertCan, birthYearOf, personDto, requireMembership } from "@/lib/families";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_PERSONS_PER_FAMILY = 10_000;

export const POST = handle(async (req) => {
  assertSameOrigin(req);
  const { user } = await requireSession();
  await enforceRateLimit(`person-create:${user.id}`, 300, 3_600_000);

  const body = await readJson(req);
  const familyId = typeof body === "object" && body !== null ? (body as Record<string, unknown>).familyId : undefined;
  if (typeof familyId !== "string" || familyId.length === 0 || familyId.length > 64) {
    throw new ApiError(422, "VALIDATION_ERROR", "Invalid input", { familyId: "ID_INVALID" });
  }

  const { role } = await requireMembership(user.id, familyId);
  assertCan(role, "person:create");

  const parsed = parsePersonInput(body);
  if (!parsed.ok) throw new ApiError(422, "VALIDATION_ERROR", "Invalid input", parsed.errors);

  const count = await prisma.person.count({ where: { familyId, deletedAt: null } });
  if (count >= MAX_PERSONS_PER_FAMILY) throw new ApiError(422, "PERSON_LIMIT", "Person limit reached");

  const person = await prisma.person.create({
    data: { ...parsed.value, familyId, birthYear: birthYearOf(parsed.value.birthDate), createdById: user.id },
  });
  await audit({ actorId: user.id, action: "person.created", entity: "Person", entityId: person.id, familyId });
  return ok({ person: personDto(person) }, 201);
});
