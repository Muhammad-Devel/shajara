import type { Relationship } from "./relationship.ts";

/** Uzbek kinship terms. (Russian/English labels are added with the i18n phase.) */
export interface LabelPerson {
  id: string;
  gender?: string | null;
  birthYear?: number | null;
}

const pick = (gender: string | null | undefined, male: string, female: string, both: string) =>
  gender === "MALE" ? male : gender === "FEMALE" ? female : both;

const ORDINAL: Record<number, string> = { 1: "birinchi", 2: "ikkinchi", 3: "uchinchi", 4: "to‘rtinchi", 5: "beshinchi" };

/** "B is A's ___" in Uzbek. `lookup` resolves people on the relationship path (to tell father's side from mother's). */
export function relationshipLabelUz(
  rel: Relationship,
  a: LabelPerson,
  b: LabelPerson,
  lookup: (id: string) => LabelPerson | undefined = () => undefined,
): string {
  const gens = rel.generations ?? 0;
  switch (rel.kind) {
    case "self":
      return "o‘zingiz";
    case "spouse":
      return pick(b.gender, "er", "xotin", "turmush o‘rtog‘i");
    case "ancestor":
      if (gens === 1) return pick(b.gender, "ota", "ona", "ota yoki ona");
      if (gens === 2) return pick(b.gender, "bobo", "buvi", "bobo yoki buvi");
      if (gens === 3) return pick(b.gender, "ulug‘ bobo", "ulug‘ buvi", "ulug‘ bobo yoki buvi");
      return `${gens}-avlod ajdodi`;
    case "descendant":
      if (gens === 1) return pick(b.gender, "o‘g‘il", "qiz", "farzand");
      if (gens === 2) return "nevara";
      if (gens === 3) return "chevara";
      return `${gens}-avlod avlodi`;
    case "sibling": {
      const bY = b.birthYear, aY = a.birthYear;
      const known = typeof bY === "number" && typeof aY === "number" && bY !== aY;
      const older = known ? (bY as number) < (aY as number) : null;
      const base =
        b.gender === "MALE" ? (older === null ? "aka yoki uka" : older ? "aka" : "uka")
        : b.gender === "FEMALE" ? (older === null ? "opa yoki singil" : older ? "opa" : "singil")
        : "aka-uka yoki opa-singil";
      return rel.half ? `${base} (ota yoki ona bir)` : base;
    }
    case "uncle_aunt": {
      if (gens !== 2) return "uzoq amaki yoki xola";
      const parent = rel.path?.[1] ? lookup(rel.path[1]) : undefined;
      if (parent?.gender === "MALE") return pick(b.gender, "amaki", "amma", "amaki yoki amma");
      if (parent?.gender === "FEMALE") return pick(b.gender, "tog‘a", "xola", "tog‘a yoki xola");
      return pick(b.gender, "amaki yoki tog‘a", "amma yoki xola", "amaki, tog‘a, amma yoki xola");
    }
    case "niece_nephew":
      return gens === 2 ? "jiyan" : "jiyanning avlodi";
    case "cousin": {
      const degree = rel.degree ?? 1, removed = rel.removed ?? 0;
      if (degree === 1 && removed === 0) {
        const path = rel.path;
        const parent = path?.[1] ? lookup(path[1]) : undefined;
        const uncle = path && path.length >= 2 ? lookup(path[path.length - 2] as string) : undefined;
        if (parent?.gender && uncle?.gender && parent.gender !== "OTHER" && uncle.gender !== "OTHER" && parent.gender !== "UNKNOWN" && uncle.gender !== "UNKNOWN") {
          const fatherSide = parent.gender === "MALE";
          if (uncle.gender === "MALE") return fatherSide ? "amakivachcha" : "tog‘avachcha";
          return fatherSide ? "ammavachcha" : "xolavachcha";
        }
        return "amakivachcha (yoki tog‘a-, amma-, xolavachcha)";
      }
      const ord = ORDINAL[degree] ?? `${degree}-`;
      const base = `${ord} darajali amakivachcha`;
      return removed ? `${base} (${removed} avlod farq bilan)` : base;
    }
    case "none":
    default:
      return "qarindoshlik topilmadi";
  }
}
