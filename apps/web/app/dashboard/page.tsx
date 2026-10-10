import { prisma } from "@shajara/database";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton, ResendVerification } from "@/components/auth/AuthForms";
import { CreateFamilyForm } from "@/components/family/FamilyForms";
import { getCurrentSession } from "@/lib/session";

export const metadata: Metadata = { title: "Bosh panel", robots: { index: false } };
export const dynamic = "force-dynamic";

const ROLE_LABEL = { OWNER: "Egasi", ADMIN: "Admin", EDITOR: "Muharrir", CONTRIBUTOR: "Hissa qo‘shuvchi", VIEWER: "Kuzatuvchi" } as const;

export default async function DashboardPage() {
  const current = await getCurrentSession();
  if (!current) redirect("/login");
  const { user } = current;

  const memberships = await prisma.familyMember.findMany({
    where: { userId: user.id, family: { deletedAt: null } },
    include: { family: true },
    orderBy: { joinedAt: "asc" },
  });

  return (
    <main className="container page">
      <header className="site-header">
        <span className="logo">SHAJARA</span>
        <LogoutButton />
      </header>

      <section className="card section">
        <h1>Salom, {user.profile?.firstName ?? "mehmon"}!</h1>
        {user.emailVerified ? null : (
          <div className="form">
            <p className="notice">Emailingiz hali tasdiqlanmagan. Pochtangizdagi havolani tekshiring.</p>
            <ResendVerification />
          </div>
        )}
      </section>

      <section className="card section" aria-labelledby="fam-title">
        <h2 id="fam-title">Mening oilalarim</h2>
        {memberships.length === 0 ? <p>Shajarangiz hali bo‘sh. Birinchi oilangizni yarating.</p> : (
          <ul className="list">
            {memberships.map((m) => (
              <li key={m.familyId} className="row">
                <Link href={`/families/${m.familyId}`}><strong>{m.family.name}</strong></Link>
                <span className="badge">{ROLE_LABEL[m.role]}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card section" aria-labelledby="new-title">
        <h2 id="new-title">Yangi oila</h2>
        <CreateFamilyForm />
      </section>
    </main>
  );
}
