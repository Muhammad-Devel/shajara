import { parseFamilyInput } from "@shajara/genealogy";
import { prisma } from "@shajara/database";
import { ApiError, assertSameOrigin, enforceRateLimit, handle, ok, readJson } from "@/lib/api";
import { audit } from "@/lib/audit";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_OWNED_FAMILIES = 10;

export const GET = handle(async () => {
  const { user } = await requireSession();
  const memberships = await prisma.familyMember.findMany({
    where: { userId: user.id, family: { deletedAt: null } },
    include: { family: true },
    orderBy: { joinedAt: "asc" },
  });
  return ok({
    families: memberships.map((m) => ({ id: m.family.id, name: m.family.name, description: m.family.description, role: m.role })),
  });
});

/** Creates the family, makes the caller its OWNER and adds them to the tree as a Person ("add yourself"). */
export const POST = handle(async (req) => {
  assertSameOrigin(req);
  const { user } = await requireSession();
  await enforceRateLimit(`family-create:${user.id}`, 20, 3_600_000);

  const parsed = parseFamilyInput(await readJson(req));
  if (!parsed.ok) throw new ApiError(422, "VALIDATION_ERROR", "Invalid input", parsed.errors);

  const owned = await prisma.familyMember.count({ where: { userId: user.id, role: "OWNER", family: { deletedAt: null } } });
  if (owned >= MAX_OWNED_FAMILIES) throw new ApiError(422, "FAMILY_LIMIT", "Family limit reached");

  const family = await prisma.family.create({
    data: {
      name: parsed.value.name,
      description: parsed.value.description,
      members: { create: { userId: user.id, role: "OWNER" } },
      persons: {
        create: {
          firstName: user.profile?.firstName ?? "Men",
          lastName: user.profile?.lastName ?? null,
          userId: user.id,
          isLiving: true,
          visibility: "FAMILY",
          createdById: user.id,
        },
      },
    },
    include: { persons: true },
  });
  await audit({ actorId: user.id, action: "family.created", entity: "Family", entityId: family.id, familyId: family.id });
  return ok(
    { family: { id: family.id, name: family.name, description: family.description, role: "OWNER" }, selfPersonId: family.persons[0]?.id ?? null },
    201,
  );
});
