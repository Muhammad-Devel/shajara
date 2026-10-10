import { prisma } from "@shajara/database";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FamilyTree } from "@/components/tree/FamilyTree";
import { canSee, getMembership, loadFamilyData } from "@/lib/families";
import { getCurrentSession } from "@/lib/session";

export const metadata: Metadata = { title: "Oila daraxti", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function TreePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const current = await getCurrentSession();
  if (!current) redirect("/login");
  const member = await getMembership(current.user.id, id);
  if (!member) notFound();

  const viewer = { role: member.role, userId: current.user.id };
  const data = await loadFamilyData(prisma, id);
  const visible = data.persons.filter((p) => canSee(viewer, p));
  const ids = new Set(visible.map((p) => p.id));
  const self = visible.find((p) => p.userId === current.user.id);

  return (
    <main className="container page">
      <header className="site-header">
        <Link href="/dashboard" className="logo">SHAJARA</Link>
        <Link href={`/families/${id}`} className="btn btn-secondary">Ro‘yxat</Link>
      </header>
      <h1>{member.family.name}</h1>
      <FamilyTree
        familyId={id}
        selfId={self?.id ?? null}
        persons={visible.map((p) => ({
          id: p.id, firstName: p.firstName, lastName: p.lastName, gender: p.gender,
          birthDate: p.birthDate, deathDate: p.deathDate, isLiving: p.isLiving,
        }))}
        parentChild={data.parentChild
          .filter((e) => ids.has(e.parentId) && ids.has(e.childId))
          .map((e) => ({ id: e.id, parentId: e.parentId, childId: e.childId }))}
        marriages={data.marriages
          .filter((m) => ids.has(m.personAId) && ids.has(m.personBId))
          .map((m) => ({ id: m.id, personAId: m.personAId, personBId: m.personBId }))}
      />
    </main>
  );
}
