import type { MarriageEdge, ParentChildEdge, PersonId } from "./types.ts";

export interface CommonAncestor {
  id: PersonId;
  distA: number;
  distB: number;
}

/** In-memory family graph. Parent→child edges form a DAG; marriages are a separate undirected relation. */
export class FamilyGraph {
  private readonly parents = new Map<PersonId, Set<PersonId>>();
  private readonly children = new Map<PersonId, Set<PersonId>>();
  private readonly spouses = new Map<PersonId, Set<PersonId>>();

  constructor(edges: ParentChildEdge[] = [], marriages: MarriageEdge[] = []) {
    for (const e of edges) this.addParentChild(e.parentId, e.childId);
    for (const m of marriages) this.addMarriage(m.personAId, m.personBId);
  }

  addParentChild(parentId: PersonId, childId: PersonId): void {
    link(this.parents, childId, parentId);
    link(this.children, parentId, childId);
  }

  addMarriage(a: PersonId, b: PersonId): void {
    link(this.spouses, a, b);
    link(this.spouses, b, a);
  }

  parentsOf(id: PersonId): PersonId[] {
    return [...(this.parents.get(id) ?? [])];
  }

  childrenOf(id: PersonId): PersonId[] {
    return [...(this.children.get(id) ?? [])];
  }

  spousesOf(id: PersonId): PersonId[] {
    return [...(this.spouses.get(id) ?? [])];
  }

  hasParentChild(parentId: PersonId, childId: PersonId): boolean {
    return this.parents.get(childId)?.has(parentId) ?? false;
  }

  hasMarriage(a: PersonId, b: PersonId): boolean {
    return this.spouses.get(a)?.has(b) ?? false;
  }

  /** Siblings = people sharing at least one parent (includes half-siblings). */
  siblingsOf(id: PersonId): PersonId[] {
    const result = new Set<PersonId>();
    for (const p of this.parents.get(id) ?? []) {
      for (const c of this.children.get(p) ?? []) if (c !== id) result.add(c);
    }
    return [...result];
  }

  /** BFS upwards. Map of ancestorId → shortest generation distance. Includes the person itself at 0. */
  ancestorsWithDistance(id: PersonId): Map<PersonId, number> {
    return bfs(id, this.parents);
  }

  descendantsWithDistance(id: PersonId): Map<PersonId, number> {
    return bfs(id, this.children);
  }

  isAncestor(maybeAncestor: PersonId, id: PersonId): boolean {
    return maybeAncestor !== id && this.ancestorsWithDistance(id).has(maybeAncestor);
  }

  /** Shortest upward path [from, ..., ancestor], or null if `ancestor` is not an ancestor of `from`. */
  ancestorPath(from: PersonId, ancestor: PersonId): PersonId[] | null {
    const prev = new Map<PersonId, PersonId | null>([[from, null]]);
    const queue: PersonId[] = [from];
    for (let i = 0; i < queue.length; i++) {
      const cur = queue[i] as PersonId;
      if (cur === ancestor) break;
      for (const p of this.parents.get(cur) ?? []) {
        if (!prev.has(p)) {
          prev.set(p, cur);
          queue.push(p);
        }
      }
    }
    if (!prev.has(ancestor)) return null;
    const path: PersonId[] = [];
    for (let cur: PersonId | null | undefined = ancestor; cur != null; cur = prev.get(cur)) path.push(cur);
    return path.reverse();
  }

  /** Common ancestors (a person counts as their own ancestor at distance 0), sorted by total distance. */
  commonAncestors(a: PersonId, b: PersonId): CommonAncestor[] {
    const ancA = this.ancestorsWithDistance(a);
    const ancB = this.ancestorsWithDistance(b);
    const result: CommonAncestor[] = [];
    for (const [id, distA] of ancA) {
      const distB = ancB.get(id);
      if (distB !== undefined) result.push({ id, distA, distB });
    }
    return result.sort((x, y) => x.distA + x.distB - (y.distA + y.distB));
  }
}

function link(map: Map<PersonId, Set<PersonId>>, key: PersonId, value: PersonId): void {
  let set = map.get(key);
  if (!set) {
    set = new Set();
    map.set(key, set);
  }
  set.add(value);
}

function bfs(start: PersonId, next: Map<PersonId, Set<PersonId>>): Map<PersonId, number> {
  const dist = new Map<PersonId, number>([[start, 0]]);
  const queue: PersonId[] = [start];
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i] as PersonId;
    const d = dist.get(cur) as number;
    for (const n of next.get(cur) ?? []) {
      if (!dist.has(n)) {
        dist.set(n, d + 1);
        queue.push(n);
      }
    }
  }
  return dist;
}
