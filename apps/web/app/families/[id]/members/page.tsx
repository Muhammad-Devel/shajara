import { INVITABLE_ROLES, can, canChangeRole, canGrantRole, canRemoveMember } from "@shajara/access";
import { prisma } from "@shajara/database";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DeleteButton } from "@/components/family/FamilyForms";
import { InviteForm, RoleSelect } from "@/components/family/MemberForms";
import { canSee, getMembership } from "@/lib/families";
import { ROLE_LABEL } from "@/lib/labels";
import { getCurrentSession } from "@/lib/session";

export const metadata: Metadata = { title: "A’zolar", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function MembersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const current = await getCurrentSession();
  if (!current) redirect("/login");
  const me = await getMembership(current.user.id, id);
  if (!me) notFound();

  const manage = can(me.role, "member:manage");
  const members = await prisma.familyMember.findMany({
    where: { familyId: id },
    include: { user: { include: { profile: true } } },
    orderBy: { joinedAt: "asc" },
  });

  const invitations = manage
    ? await prisma.invitation.findMany({ where: { familyId: id, status: "PENDING", expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } })
    : [];
  const unlinked = manage
    ? (await prisma.person.findMany({ where: { familyId: id, deletedAt: null, userId: null }, orderBy: { createdAt: "asc" } }))
        .filter((p) => canSee({ role: me.role, userId: current.user.id }, p))
    : [];
  const personName = (pid: string | null) => {
    const p = unlinked.find((x) => x.id === pid);
    return p ? `${p.firstName}${p.lastName ? " " + p.lastName : ""}` : null;
  };
  const grantable = INVITABLE_ROLES.filter((r) => canGrantRole(me.role, r));

  return (
    <main className="container page">
      <header className="site-header">
        <Link href="/dashboard" className="logo">SHAJARA</Link>
        <Link href={`/families/${id}`} className="btn btn-secondary">Orqaga</Link>
      </header>
      <h1>{me.family.name}: a’zolar</h1>

      <section className="card section" aria-labelledby="mem-title">
        <h2 id="mem-title">A’zolar ({members.length})</h2>
        <ul className="list">
          {members.map((m) => {
            const name = m.user.profile ? `${m.user.profile.firstName} ${m.user.profile.lastName}` : "Noma’lum";
            const isYou = m.userId === current.user.id;
            const roleOptions = INVITABLE_ROLES.filter((r) => canChangeRole(me.role, m.role, r));
            const removable = canRemoveMember({ actor: me.role, actorId: current.user.id, target: m.role, targetId: m.userId });
            return (
              <li key={m.userId} className="row">
                <div>
                  <strong>{name}</strong>{isYou ? <span className="badge">Siz</span> : null}
                  {manage ? <div className="muted">{m.user.email}</div> : null}
                </div>
                <div className="row-actions">
                  {roleOptions.length > 0 && !isYou
                    ? <RoleSelect familyId={id} userId={m.userId} current={m.role} options={[...roleOptions]} />
                    : <span className="badge">{ROLE_LABEL[m.role]}</span>}
                  {removable ? (
                    <DeleteButton
                      path={`families/${id}/members/${m.userId}`}
                      label={isYou ? "Oiladan chiqish" : "Chiqarish"}
                      confirmText={isYou ? "Oiladan chiqmoqchimisiz? Kiritgan ma’lumotlaringiz shajarada qoladi." : `${name} oiladan chiqarilsinmi? Kiritgan ma’lumotlari shajarada qoladi.`}
                    />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {manage ? (
        <>
          <section className="card section" aria-labelledby="inv-title">
            <h2 id="inv-title">Qarindoshni taklif qilish</h2>
            <InviteForm
              familyId={id}
              grantableRoles={[...grantable]}
              people={unlinked.map((p) => ({ id: p.id, name: `${p.firstName}${p.lastName ? " " + p.lastName : ""}` }))}
            />
          </section>

          <section className="card section" aria-labelledby="pend-title">
            <h2 id="pend-title">Kutilayotgan takliflar ({invitations.length})</h2>
            {invitations.length === 0 ? <p>Hozircha yo‘q.</p> : (
              <ul className="list">
                {invitations.map((i) => (
                  <li key={i.id} className="row">
                    <div>
                      <strong>{ROLE_LABEL[i.role]}</strong>
                      {i.email ? <span className="muted"> · {i.email}</span> : <span className="muted"> · havola orqali</span>}
                      {personName(i.personId) ? <span className="muted"> · {personName(i.personId)}</span> : null}
                      <div className="muted">Muddati: {i.expiresAt.toLocaleDateString("uz-UZ")}</div>
                    </div>
                    {canGrantRole(me.role, i.role)
                      ? <DeleteButton path={`invitations/${i.id}`} label="Bekor qilish" confirmText="Taklif bekor qilinsinmi?" />
                      : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
