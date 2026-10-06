import type { FamilyGraph } from "./graph.ts";
import type { PersonId } from "./types.ts";

/**
 * Describes who B is relative to A ("B is A's ...").
 * Language-neutral: the UI maps `kind` + numbers to Uzbek/Russian/English labels.
 */
export type RelationshipKind =
  | "self"
  | "spouse"
  | "ancestor" // B is A's parent (generations=1), grandparent (2), ...
  | "descendant" // B is A's child (1), grandchild (2), ...
  | "sibling"
  | "uncle_aunt" // generations=2 → uncle/aunt, 3 → great-uncle/aunt, ...
  | "niece_nephew" // generations=2 → niece/nephew, 3 → grand-niece/nephew, ...
  | "cousin"
  | "none";

export interface Relationship {
  kind: RelationshipKind;
  /** Generations between A/B and the closest common ancestor, when relevant. */
  generations?: number;
  /** Cousin degree: 1 = first cousin, 2 = second cousin... */
  degree?: number;
  /** Cousin "removed" count (generation difference). */
  removed?: number;
  /** Sibling sharing only one parent. */
  half?: boolean;
  /** Person ids from A to B through the common ancestor (for the "path" UI). Not set for spouse/none. */
  path?: PersonId[];
}

export function calculateRelationship(graph: FamilyGraph, a: PersonId, b: PersonId): Relationship {
  if (a === b) return { kind: "self", path: [a] };
  if (graph.hasMarriage(a, b)) return { kind: "spouse", path: [a, b] };

  const common = graph.commonAncestors(a, b);
  const best = common[0];
  if (!best) return { kind: "none" };

  const { distA, distB } = best;
  const path = buildPath(graph, a, b, best.id);

  if (distA === 0) return { kind: "descendant", generations: distB, path };
  if (distB === 0) return { kind: "ancestor", generations: distA, path };

  if (distA === 1 && distB === 1) {
    const sharedAtBest = common.filter((c) => c.distA === 1 && c.distB === 1).length;
    return { kind: "sibling", half: sharedAtBest === 1, path };
  }
  if (distA === 1) return { kind: "niece_nephew", generations: distB, path };
  if (distB === 1) return { kind: "uncle_aunt", generations: distA, path };

  return {
    kind: "cousin",
    degree: Math.min(distA, distB) - 1,
    removed: Math.abs(distA - distB),
    path,
  };
}

function buildPath(graph: FamilyGraph, a: PersonId, b: PersonId, ancestor: PersonId): PersonId[] {
  const up = graph.ancestorPath(a, ancestor) ?? [a];
  const down = (graph.ancestorPath(b, ancestor) ?? [b]).slice().reverse();
  return [...up, ...down.slice(1)];
}
