import { calculateRelationship } from "@shajara/genealogy";
import { prisma } from "@shajara/database";
import { ApiError, handle, ok } from "@/lib/api";
import { buildGraph, canSee, loadFamilyData, requirePerson } from "@/lib/families";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; targetId: string }> };

/** "Who is B to A?" The path is returned only if every person on it is visible to the caller. */
export const GET = handle<Ctx>(async (_req, { params }) => {
  const { id, targetId } = await params;
  const { user } = await requireSession();
  const { person: a, role } = await requirePerson(user.id, id);
  const { person: b } = await requirePerson(user.id, targetId);
  if (a.familyId !== b.familyId) throw new ApiError(422, "DIFFERENT_FAMILIES", "People belong to different families");

  const data = await loadFamilyData(prisma, a.familyId);
  const { path, ...rest } = calculateRelationship(buildGraph(data), a.id, b.id);
  const byId = new Map(data.persons.map((p) => [p.id, p]));
  const viewer = { role, userId: user.id };
  const pathVisible = path?.every((pid) => {
    const p = byId.get(pid);
    return p !== undefined && canSee(viewer, p);
  });
  return ok({ relationship: { ...rest, ...(path && pathVisible ? { path } : {}) } });
});
