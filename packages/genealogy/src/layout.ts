import { FamilyGraph } from "./graph.ts";

/**
 * Family-tree layout (pure, deterministic, no DOM).
 *
 * Model: spouses form a "unit" shown side by side on one row. Every unit hangs under ONE primary parent unit
 * (a person with parents in two different units is drawn under the first; the other link is drawn as a longer line).
 * Subtrees get disjoint horizontal spans, so cards on the same row never overlap. Complexity is O(n) per pass.
 */

export const LAYOUT_DEFAULTS = { nodeW: 180, nodeH: 88, hGap: 32, spouseGap: 24, vGap: 72 } as const;
export type LayoutOptions = { [K in keyof typeof LAYOUT_DEFAULTS]?: number };

export interface LayoutPerson {
  id: string;
  gender?: string | null;
  birthYear?: number | null;
}
export interface LayoutEdge { parentId: string; childId: string }
export interface LayoutMarriage { personAId: string; personBId: string }

export interface LayoutNode {
  id: string;
  x: number; // top-left
  y: number;
  w: number;
  h: number;
  generation: number;
  unit: number;
}

export interface ParentLink {
  childId: string;
  parentIds: string[];
  /** SVG path (orthogonal elbow). */
  path: string;
  minX: number; minY: number; maxX: number; maxY: number;
}
export interface MarriageLink { aId: string; bId: string; x1: number; x2: number; y: number }

export interface Layout {
  nodes: LayoutNode[];
  byId: Map<string, LayoutNode>;
  links: ParentLink[];
  marriageLinks: MarriageLink[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  generations: number;
}

const byIdAsc = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function computeLayout(
  persons: LayoutPerson[],
  parentChild: LayoutEdge[],
  marriages: LayoutMarriage[],
  options: LayoutOptions = {},
): Layout {
  const { nodeW, nodeH, hGap, spouseGap, vGap } = { ...LAYOUT_DEFAULTS, ...options };
  const info = new Map(persons.map((p) => [p.id, p]));
  const ids = [...info.keys()].sort(byIdAsc);

  const parentsOf = new Map<string, string[]>();
  const childrenOf = new Map<string, string[]>();
  for (const e of parentChild) {
    if (!info.has(e.parentId) || !info.has(e.childId) || e.parentId === e.childId) continue;
    push(parentsOf, e.childId, e.parentId);
    push(childrenOf, e.parentId, e.childId);
  }
  const spousesOf = new Map<string, string[]>();
  const marr = marriages.filter((m) => info.has(m.personAId) && info.has(m.personBId) && m.personAId !== m.personBId);
  for (const m of marr) {
    push(spousesOf, m.personAId, m.personBId);
    push(spousesOf, m.personBId, m.personAId);
  }

  // 1. Generations: child ≥ parent + 1, spouses on the same row. Values only grow → terminates.
  const gen = new Map<string, number>(ids.map((id) => [id, 0]));
  for (let iter = 0; iter < ids.length + 2; iter++) {
    let changed = false;
    for (const id of ids) {
      const ps = parentsOf.get(id);
      if (!ps) continue;
      const g = Math.max(...ps.map((p) => gen.get(p) ?? 0)) + 1;
      if (g > (gen.get(id) as number)) { gen.set(id, g); changed = true; }
    }
    for (const m of marr) {
      const g = Math.max(gen.get(m.personAId) as number, gen.get(m.personBId) as number);
      if (gen.get(m.personAId) !== g) { gen.set(m.personAId, g); changed = true; }
      if (gen.get(m.personBId) !== g) { gen.set(m.personBId, g); changed = true; }
    }
    if (!changed) break;
  }

  // 2. Units = connected spouses.
  const unitOf = new Map<string, number>();
  const units: string[][] = [];
  for (const id of ids) {
    if (unitOf.has(id)) continue;
    const component: string[] = [];
    const stack = [id];
    unitOf.set(id, units.length);
    while (stack.length) {
      const cur = stack.pop() as string;
      component.push(cur);
      for (const s of spousesOf.get(cur) ?? []) {
        if (!unitOf.has(s)) { unitOf.set(s, units.length); stack.push(s); }
      }
    }
    units.push(orderUnit(component, spousesOf, info));
  }

  // 3. Primary parent unit for every unit (first member that has parents; lowest parent id).
  const parentUnit: (number | undefined)[] = units.map((members, u) => {
    for (const m of members) {
      const ps = parentsOf.get(m);
      if (ps?.length) {
        const pu = unitOf.get([...ps].sort(byIdAsc)[0] as string);
        if (pu !== undefined && pu !== u) return pu;
      }
    }
    return undefined;
  });
  const childUnits: number[][] = units.map(() => []);
  parentUnit.forEach((pu, u) => { if (pu !== undefined) (childUnits[pu] as number[]).push(u); });
  const sortKey = (u: number): [number, string] => {
    const years = (units[u] as string[]).map((m) => info.get(m)?.birthYear).filter((y): y is number => typeof y === "number");
    return [years.length ? Math.min(...years) : Number.MAX_SAFE_INTEGER, (units[u] as string[])[0] as string];
  };
  for (const list of childUnits) {
    list.sort((a, b) => {
      const [ya, ia] = sortKey(a), [yb, ib] = sortKey(b);
      return ya !== yb ? ya - yb : byIdAsc(ia, ib);
    });
  }

  // 4. Subtree widths (post-order, iterative) and placement.
  const unitW = (u: number) => (units[u] as string[]).length * nodeW + ((units[u] as string[]).length - 1) * spouseGap;
  const subtreeW = new Array<number>(units.length).fill(0);
  const visited = new Array<boolean>(units.length).fill(false);
  const order: number[] = []; // pre-order of the forest
  const roots = units.map((_, u) => u).filter((u) => parentUnit[u] === undefined);
  const walk = (start: number) => {
    const stack = [start];
    while (stack.length) {
      const u = stack.pop() as number;
      if (visited[u]) continue;
      visited[u] = true;
      order.push(u);
      for (let i = (childUnits[u] as number[]).length - 1; i >= 0; i--) stack.push((childUnits[u] as number[])[i] as number);
    }
  };
  for (const r of roots) walk(r);
  // Units left over are in a (pathological) cycle of marriages/parents: treat them as extra roots.
  for (let u = 0; u < units.length; u++) {
    if (!visited[u]) { parentUnit[u] = undefined; roots.push(u); walk(u); }
  }
  const kids = (u: number) => (childUnits[u] as number[]).filter((c) => parentUnit[c] === u);
  for (let i = order.length - 1; i >= 0; i--) {
    const u = order[i] as number;
    const ks = kids(u);
    const childrenTotal = ks.reduce((s, c) => s + (subtreeW[c] as number), 0) + hGap * Math.max(0, ks.length - 1);
    subtreeW[u] = Math.max(unitW(u), childrenTotal);
  }

  const nodes: LayoutNode[] = [];
  const byId = new Map<string, LayoutNode>();
  const place = (u: number, left: number) => {
    const stack: [number, number][] = [[u, left]];
    while (stack.length) {
      const [cur, l] = stack.pop() as [number, number];
      const width = subtreeW[cur] as number;
      let x = l + (width - unitW(cur)) / 2;
      for (const m of units[cur] as string[]) {
        const g = gen.get(m) as number;
        const node: LayoutNode = { id: m, x, y: g * (nodeH + vGap), w: nodeW, h: nodeH, generation: g, unit: cur };
        nodes.push(node);
        byId.set(m, node);
        x += nodeW + spouseGap;
      }
      const ks = kids(cur);
      const childrenTotal = ks.reduce((s, c) => s + (subtreeW[c] as number), 0) + hGap * Math.max(0, ks.length - 1);
      let cursor = l + (width - childrenTotal) / 2;
      for (const c of ks) {
        stack.push([c, cursor]);
        cursor += (subtreeW[c] as number) + hGap;
      }
    }
  };
  let cursor = 0;
  for (const r of roots) {
    place(r, cursor);
    cursor += (subtreeW[r] as number) + hGap * 2;
  }

  // 5. Links.
  const marriageLinks: MarriageLink[] = [];
  const drawn = new Set<string>();
  for (const m of marr) {
    const a = byId.get(m.personAId) as LayoutNode, b = byId.get(m.personBId) as LayoutNode;
    const key = byIdAsc(a.id, b.id) < 0 ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
    if (drawn.has(key)) continue;
    drawn.add(key);
    const [l, r] = a.x <= b.x ? [a, b] : [b, a];
    marriageLinks.push({ aId: l.id, bId: r.id, x1: l.x + l.w, x2: r.x, y: l.y + l.h / 2 });
  }

  const links: ParentLink[] = [];
  for (const id of ids) {
    const ps = (parentsOf.get(id) ?? []).slice().sort(byIdAsc);
    if (!ps.length) continue;
    const child = byId.get(id) as LayoutNode;
    const cx = child.x + child.w / 2;
    // group parents that are spouses of each other (same unit) into one junction between the couple
    const groups = new Map<number, string[]>();
    for (const p of ps) {
      const u = (byId.get(p) as LayoutNode).unit;
      const list = groups.get(u);
      if (list) list.push(p); else groups.set(u, [p]);
    }
    for (const group of groups.values()) {
      const nodesG = group.map((p) => byId.get(p) as LayoutNode).sort((a, b) => a.x - b.x);
      let x1: number, y1: number;
      if (nodesG.length >= 2) {
        const first = nodesG[0] as LayoutNode, last = nodesG[nodesG.length - 1] as LayoutNode;
        x1 = (first.x + first.w + last.x) / 2;
        y1 = first.y + first.h / 2;
      } else {
        const n = nodesG[0] as LayoutNode;
        x1 = n.x + n.w / 2;
        y1 = n.y + n.h;
      }
      const yMid = child.y - vGap / 2;
      links.push({
        childId: id,
        parentIds: group,
        path: `M${x1} ${y1}V${yMid}H${cx}V${child.y}`,
        minX: Math.min(x1, cx), maxX: Math.max(x1, cx), minY: Math.min(y1, child.y), maxY: Math.max(y1, child.y),
      });
    }
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, maxGen = 0;
  for (const n of nodes) {
    minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.w); maxY = Math.max(maxY, n.y + n.h);
    maxGen = Math.max(maxGen, n.generation);
  }
  if (!nodes.length) { minX = minY = maxX = maxY = 0; }
  return { nodes, byId, links, marriageLinks, bounds: { minX, minY, maxX, maxY }, generations: nodes.length ? maxGen + 1 : 0 };
}

/** Persons hidden by collapsed branches: descendants of collapsed people (and their spouses). Collapsed people stay visible. */
export function computeHidden(
  collapsed: ReadonlySet<string>,
  parentChild: LayoutEdge[],
  marriages: LayoutMarriage[],
): Set<string> {
  if (collapsed.size === 0) return new Set();
  const graph = new FamilyGraph(parentChild, marriages);
  const hidden = new Set<string>();
  for (const c of collapsed) {
    for (const d of graph.descendantsWithDistance(c).keys()) if (d !== c) hidden.add(d);
  }
  for (const h of [...hidden]) for (const s of graph.spousesOf(h)) hidden.add(s);
  for (const c of collapsed) {
    hidden.delete(c);
    for (const s of graph.spousesOf(c)) hidden.delete(s);
  }
  return hidden;
}

function push(map: Map<string, string[]>, key: string, value: string): void {
  const list = map.get(key);
  if (list) { if (!list.includes(value)) list.push(value); } else map.set(key, [value]);
}

/** Order members of a unit left→right: a chain walk starting from an end person; MALE first in a plain couple. */
function orderUnit(members: string[], spousesOf: Map<string, string[]>, info: Map<string, LayoutPerson>): string[] {
  if (members.length <= 1) return members;
  const sorted = [...members].sort(byIdAsc);
  if (members.length === 2) {
    const [a, b] = sorted as [string, string];
    return info.get(b)?.gender === "MALE" && info.get(a)?.gender !== "MALE" ? [b, a] : [a, b];
  }
  const degree = (id: string) => (spousesOf.get(id) ?? []).length;
  const start = [...sorted].sort((a, b) => degree(a) - degree(b) || byIdAsc(a, b))[0] as string;
  const seen = new Set<string>([start]);
  const out = [start];
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    for (const s of [...(spousesOf.get(queue[i] as string) ?? [])].sort(byIdAsc)) {
      if (!seen.has(s)) { seen.add(s); out.push(s); queue.push(s); }
    }
  }
  return out;
}
