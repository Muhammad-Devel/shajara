import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://shajara.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "SHAJARA — Avlodlarni bog‘laymiz. Tarixni saqlaymiz.",
    template: "%s | SHAJARA",
  },
  description:
    "Oilangiz shajarasini, fotosuratlari va hikoyalarini raqamli shaklda saqlang va avlodlarga o‘tkazing.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "SHAJARA",
    title: "SHAJARA — Avlodlarni bog‘laymiz. Tarixni saqlaymiz.",
    description: "Oilaviy shajara va raqamli oila arxivi.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f2e8" },
    { media: "(prefers-color-scheme: dark)", color: "#121915" },
  ],
};

// Applies a saved theme before first paint to avoid a flash. "System" = no data-theme attribute.
const themeInit = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t}}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uz" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
