import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TreeArt } from "@/components/TreeArt";

const FEATURES = [
  { title: "Interaktiv shajara", text: "Oila a’zolarini daraxt ko‘rinishida qo‘shing, kattalashtiring va qidiring." },
  { title: "Oila arxivi", text: "Eski fotosuratlar, hikoyalar va hujjatlar bir joyda, faqat oilangiz uchun." },
  { title: "Maxfiylik birinchi o‘rinda", text: "Tirik insonlar ma’lumoti sukut bo‘yicha yopiq. Nimani ko‘rsatishni siz hal qilasiz." },
];

export default function HomePage() {
  return (
    <>
      <div className="container">
        <header className="site-header">
          <Link href="/" className="logo" aria-label="SHAJARA bosh sahifa">SHAJARA</Link>
          <nav className="nav" aria-label="Asosiy">
            <ThemeToggle />
            <Link href="/login" className="btn btn-secondary">Kirish</Link>
          </nav>
        </header>

        <main id="main">
          <section className="hero" aria-labelledby="hero-title">
            <div>
              <p className="eyebrow">Raqamli oila merosi</p>
              <h1 id="hero-title">Avlodlarni bog‘lang. Tarixingizni saqlang.</h1>
              <p className="lead">
                Ota-bobolaringiz, oilangiz va uning hikoyalarini bir shajarada jamlang, toki ular
                kelajak avlodlargacha yetib borsin.
              </p>
              <div className="cta">
                <Link href="/register" className="btn btn-primary">Shajarangizni yarating</Link>
                <a href="#features" className="btn btn-secondary">SHAJARA bilan tanishing</a>
              </div>
            </div>
            <TreeArt />
          </section>

          <section id="features" className="features" aria-label="Imkoniyatlar">
            {FEATURES.map((f) => (
              <article key={f.title} className="card">
                <h2>{f.title}</h2>
                <p>{f.text}</p>
              </article>
            ))}
          </section>
        </main>
      </div>
      <footer className="site-footer">Avlodlarni bog‘laymiz. Tarixni saqlaymiz.</footer>
    </>
  );
}
