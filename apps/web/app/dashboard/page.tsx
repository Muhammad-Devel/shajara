import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogoutButton, ResendVerification } from "@/components/auth/AuthForms";
import { getCurrentSession } from "@/lib/session";

export const metadata: Metadata = { title: "Bosh panel", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const current = await getCurrentSession();
  if (!current) redirect("/login");
  const { user } = current;

  return (
    <main className="container">
      <header className="site-header">
        <span className="logo">SHAJARA</span>
        <LogoutButton />
      </header>
      <section className="card" style={{ marginBlock: "var(--space-8)" }}>
        <h1>Salom, {user.profile?.firstName ?? "mehmon"}!</h1>
        <p className="lead">Shajarangizni yaratish tez orada shu yerda boshlanadi.</p>
        {user.emailVerified ? null : (
          <div className="form">
            <p className="notice">Emailingiz hali tasdiqlanmagan. Pochtangizdagi havolani tekshiring.</p>
            <ResendVerification />
          </div>
        )}
      </section>
    </main>
  );
}
