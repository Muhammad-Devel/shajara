import type { Metadata } from "next";
import Link from "next/link";
import { AcceptInvite } from "@/components/family/MemberForms";
import { getMembership } from "@/lib/families";
import { findUsableInvitation, invitedPerson } from "@/lib/invitations";
import { ROLE_LABEL } from "@/lib/labels";
import { getCurrentSession } from "@/lib/session";

export const metadata: Metadata = { title: "Oilaga taklif", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = await findUsableInvitation(token);

  if (!inv) {
    return (
      <main className="auth-wrap">
        <Link href="/" className="logo">SHAJARA</Link>
        <section className="card auth-card">
          <h1>Taklif yaroqsiz</h1>
          <p>Havola noto‘g‘ri, allaqachon ishlatilgan yoki muddati o‘tgan. Sizni taklif qilgan odamdan yangi havola so‘rang.</p>
          <Link href="/" className="btn btn-secondary">Bosh sahifa</Link>
        </section>
      </main>
    );
  }

  const person = await invitedPerson(inv);
  const current = await getCurrentSession();
  const already = current ? await getMembership(current.user.id, inv.familyId) : null;
  const q = `?next=${encodeURIComponent(`/invite/${token}`)}`;
  const inviter = inv.invitedBy.profile?.firstName;

  return (
    <main className="auth-wrap">
      <Link href="/" className="logo">SHAJARA</Link>
      <section className="card auth-card" aria-labelledby="inv-title">
        <h1 id="inv-title">“{inv.family.name}” oilasiga taklif</h1>
        <p>
          {inviter ? <>{inviter} sizni</> : <>Sizni</>} oilaga <strong>{ROLE_LABEL[inv.role]}</strong> sifatida taklif qildi.
          {person ? <> Akkauntingiz shajaradagi <strong>{person.firstName}{person.lastName ? " " + person.lastName : ""}</strong> kartasiga bog‘lanadi.</> : null}
        </p>
        {inv.email ? <p className="muted">Bu taklif faqat bitta email manzil uchun yuborilgan.</p> : null}

        {already ? (
          <>
            <p role="status">Siz allaqachon bu oila a’zosisiz.</p>
            <Link className="btn btn-primary" href={`/families/${inv.familyId}/tree`}>Daraxtni ochish</Link>
          </>
        ) : current ? (
          <AcceptInvite token={token} />
        ) : (
          <div className="form">
            <Link className="btn btn-primary" href={`/register${q}`}>Ro‘yxatdan o‘tib qo‘shilish</Link>
            <Link className="btn btn-secondary" href={`/login${q}`}>Akkauntim bor, kirish</Link>
          </div>
        )}
      </section>
    </main>
  );
}
