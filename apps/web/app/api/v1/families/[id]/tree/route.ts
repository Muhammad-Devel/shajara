import { prisma } from "@shajara/database";
import { handle, ok } from "@/lib/api";
import { canSee, loadFamilyData, personDto, requireMembership } from "@/lib/families";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Everything the tree view needs, filtered to what the caller may see. Links to hidden people are dropped. */
export const GET = handle<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const { user } = await requireSession();
  const { family, role } = await requireMembership(user.id, id);
  const data = await loadFamilyData(prisma, id);

  const viewer = { role, userId: user.id };
  const visible = data.persons.filter((p) => canSee(viewer, p));
  const ids = new Set(visible.map((p) => p.id));

  return ok({
    family: { id: family.id, name: family.name },
    role,
    persons: visible.map(personDto),
    parentChild: data.parentChild
      .filter((e) => ids.has(e.parentId) && ids.has(e.childId))
      .map((e) => ({ id: e.id, parentId: e.parentId, childId: e.childId, type: e.type })),
    marriages: data.marriages
      .filter((m) => ids.has(m.personAId) && ids.has(m.personBId))
      .map((m) => ({ id: m.id, personAId: m.personAId, personBId: m.personBId, status: m.status, startDate: m.startDate, endDate: m.endDate })),
  });
});
