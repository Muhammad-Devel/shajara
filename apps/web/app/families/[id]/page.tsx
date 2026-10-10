import { can, canModifyPerson } from "@shajara/access";
import { prisma } from "@shajara/database";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AddPersonForm, AddRelationForm, DeleteButton } from "@/components/family/FamilyForms";
import { canSee, getMembership, loadFamilyData } from "@/lib/families";
import { getCurrentSession } from "@/lib/session";

export const metadata: Metadata = { title: "Oila", robots: { index: false } };
export const dynamic = "force-dynamic";

const VISIBILITY_LABEL = { PRIVATE: "Yopiq", SELECTED: "Tanlangan", FAMILY: "Oila", PUBLIC: "Ochiq" } as const;

export default async function FamilyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const current = await getCurrentSession();
  if (!current) redirect("/login");
  const member = await getMembership(current.user.id, id);
  if (!member) notFound();

  const { role } = member;
  const viewer = { role, userId: current.user.id };
  const data = await loadFamilyData(prisma, id);
  const people = data.persons.filter((p) => canSee(viewer, p));
  const byId = new Map(people.map((p) => [p.id, p]));
  const name = (pid: string) => {
    const p = byId.get(pid);
    return p ? `${p.firstName}${p.lastName ? " " + p.lastName : ""}` : "—";
  };
  const parentEdges = data.parentChild.filter((e) => byId.has(e.parentId) && byId.has(e.childId));
  const marriages = data.marriages.filter((m) => byId.has(m.personAId) && byId.has(m.personBId));
  const canRelate = can(role, "relation:manage");

  return (
    <main className="container page">
      <header className="site-header">
        <Link href="/dashboard" className="logo">SHAJARA</Link>
        <nav className="nav">
          <Link href={`/families/${id}/tree`} className="btn btn-primary">Daraxtni ochish</Link>
          <Link href={`/families/${id}/members`} className="btn btn-secondary">A’zolar</Link>
          <Link href="/dashboard" className="btn btn-secondary">Orqaga</Link>
        </nav>
      </header>

      <h1>{member.family.name}</h1>
      {member.family.description ? <p className="lead">{member.family.description}</p> : null}

      <section className="card section" aria-labelledby="people-title">
        <h2 id="people-title">Odamlar ({people.length})</h2>
        {people.length === 0 ? <p>Shajarangiz hali bo‘sh. Birinchi odamni qo‘shing.</p> : (
          <ul className="list">
            {people.map((p) => (
              <li key={p.id} className="row">
                <div>
                  <strong>{name(p.id)}</strong>{" "}
                  <span className="muted">{p.birthDate ?? "?"} — {p.deathDate ?? (p.isLiving ? "" : "?")}</span>{" "}
                  <span className="badge">{VISIBILITY_LABEL[p.visibility]}</span>
                  {p.userId ? <span className="badge">Akkaunt</span> : null}
                </div>
                {canModifyPerson(role, current.user.id, p.createdById) && !p.userId ? (
                  <DeleteButton path={`persons/${p.id}`} confirmText={`${name(p.id)} o‘chirilsinmi?`} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card section" aria-labelledby="rel-title">
        <h2 id="rel-title">Bog‘lanishlar</h2>
        {parentEdges.length + marriages.length === 0 ? <p>Hozircha bog‘lanish yo‘q.</p> : (
          <ul className="list">
            {parentEdges.map((e) => (
              <li key={e.id} className="row">
                <span>{name(e.parentId)} <span className="muted">→ ota-ona →</span> {name(e.childId)}</span>
                {canRelate ? <DeleteButton path={`parent-child/${e.id}`} confirmText="Bog‘lanish o‘chirilsinmi?" /> : null}
              </li>
            ))}
            {marriages.map((m) => (
              <li key={m.id} className="row">
                <span>{name(m.personAId)} <span className="muted">⚭</span> {name(m.personBId)}</span>
                {canRelate ? <DeleteButton path={`marriages/${m.id}`} confirmText="Bog‘lanish o‘chirilsinmi?" /> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {can(role, "person:create") ? (
        <section className="card section" aria-labelledby="add-title">
          <h2 id="add-title">Odam qo‘shish</h2>
          <AddPersonForm familyId={id} />
        </section>
      ) : null}

      {canRelate && people.length >= 2 ? (
        <section className="card section" aria-labelledby="link-title">
          <h2 id="link-title">Odamlarni bog‘lash</h2>
          <AddRelationForm people={people.map((p) => ({ id: p.id, name: name(p.id) }))} />
        </section>
      ) : null}
    </main>
  );
}
