import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Kirish", robots: { index: false } };

export default function Page() {
  return (
    <main className="centered">
      <h1>Kirish</h1>
      <p className="lead">Bu sahifa tez orada ishga tushadi.</p>
      <Link href="/" className="btn btn-primary">Bosh sahifaga qaytish</Link>
    </main>
  );
}
