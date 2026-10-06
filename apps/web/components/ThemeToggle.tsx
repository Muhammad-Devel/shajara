"use client";

import { useEffect, useState } from "react";

type Theme = "system" | "light" | "dark";
const ORDER: Theme[] = ["system", "light", "dark"];
const LABEL: Record<Theme, string> = { system: "Tizim", light: "Yorug‘", dark: "Qorong‘i" };

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("theme");
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch {
      /* storage unavailable: stay on system */
    }
  }, []);

  function cycle() {
    const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length] ?? "system";
    setTheme(next);
    const root = document.documentElement;
    try {
      if (next === "system") {
        localStorage.removeItem("theme");
        delete root.dataset.theme;
      } else {
        localStorage.setItem("theme", next);
        root.dataset.theme = next;
      }
    } catch {
      if (next === "system") delete root.dataset.theme;
      else root.dataset.theme = next;
    }
  }

  return (
    <button type="button" className="btn btn-ghost" onClick={cycle} aria-label={`Mavzu: ${LABEL[theme]}. O‘zgartirish uchun bosing`}>
      {LABEL[theme]}
    </button>
  );
}
