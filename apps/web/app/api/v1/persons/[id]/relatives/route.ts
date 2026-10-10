import { prisma } from "@shajara/database";
import { handle, ok } from "@/lib/api";
import { buildGraph, canSee, loadFamilyData, personDto, requirePerson } from "@/lib/families";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const { user } = await requireSession();
  const { person, role } = await requirePerson(user.id, id);
  const data = await loadFamilyData(prisma, person.familyId);
  const graph = buildGraph(data);
  const byId = new Map(data.persons.map((p) => [p.id, p]));
  const viewer = { role, userId: user.id };

  const pick = (ids: string[]) =>
    ids.flatMap((pid) => {
      const p = byId.get(pid);
      return p && canSee(viewer, p) ? [personDto(p)] : [];
    });

  return ok({
    parents: pick(graph.parentsOf(id)),
    children: pick(graph.childrenOf(id)),
    spouses: pick(graph.spousesOf(id)),
    siblings: pick(graph.siblingsOf(id)),
  });
});
