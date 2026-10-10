import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FamilyGraph, calculateRelationship, computeHidden, computeLayout, relationshipLabelUz, LAYOUT_DEFAULTS,
  type LayoutEdge, type LayoutMarriage, type LayoutPerson,
} from "../src/index.ts";

const P = (id: string, gender?: string, birthYear?: number): LayoutPerson => ({ id, gender, birthYear });
const E = (parentId: string, childId: string): LayoutEdge => ({ parentId, childId });
const M = (personAId: string, personBId: string): LayoutMarriage => ({ personAId, personBId });

function assertNoOverlap(nodes: { id: string; x: number; y: number; w: number }[]) {
  const rows = new Map<number, typeof nodes>();
  for (const n of nodes) (rows.get(n.y) ?? rows.set(n.y, []).get(n.y)!).push(n);
  for (const row of rows.values()) {
    row.sort((a, b) => a.x - b.x);
    for (let i = 1; i < row.length; i++) {
      const prev = row[i - 1]!, cur = row[i]!;
      assert.ok(prev.x + prev.w <= cur.x, `${prev.id} overlaps ${cur.id}`);
    }
  }
}

// grandpa ⚭ grandma → dad ⚭ mom → me, sis ; grandpa → uncle
const people = [P("grandpa", "MALE", 1930), P("grandma", "FEMALE", 1935), P("dad", "MALE", 1960), P("uncle", "MALE", 1963),
  P("mom", "FEMALE", 1962), P("me", "MALE", 1990), P("sis", "FEMALE", 1993)];
const edges = [E("grandpa", "dad"), E("grandma", "dad"), E("grandpa", "uncle"), E("grandma", "uncle"),
  E("dad", "me"), E("mom", "me"), E("dad", "sis"), E("mom", "sis")];
const marriages = [M("grandpa", "grandma"), M("dad", "mom")];

describe("computeLayout", () => {
  const L = computeLayout(people, edges, marriages);
  const n = (id: string) => L.byId.get(id)!;

  it("places every person once, generations top-down", () => {
    assert.equal(L.nodes.length, people.length);
    assert.equal(n("grandpa").generation, 0);
    assert.equal(n("dad").generation, 1);
    assert.equal(n("me").generation, 2);
    assert.equal(L.generations, 3);
    assert.ok(n("me").y > n("dad").y && n("dad").y > n("grandpa").y);
  });
  it("puts spouses side by side on one row (male first)", () => {
    assert.equal(n("grandpa").y, n("grandma").y);
    assert.ok(n("grandpa").x < n("grandma").x);
    assert.equal(n("grandma").x - (n("grandpa").x + LAYOUT_DEFAULTS.nodeW), LAYOUT_DEFAULTS.spouseGap);
  });
  it("married-in spouse (no parents) lands on the partner's row", () => {
    assert.equal(n("mom").generation, n("dad").generation);
  });
  it("never overlaps cards on a row", () => assertNoOverlap(L.nodes));
  it("orders siblings by birth year and centers children under the couple", () => {
    assert.ok(n("dad").x < n("uncle").x);
    assert.ok(n("me").x < n("sis").x);
    const coupleCenter = (n("dad").x + n("mom").x + LAYOUT_DEFAULTS.nodeW) / 2;
    const kidsCenter = (n("me").x + n("sis").x + LAYOUT_DEFAULTS.nodeW) / 2;
    assert.ok(Math.abs(coupleCenter - kidsCenter) < 1);
  });
  it("draws one junction link per child for a couple, plus marriage links", () => {
    assert.equal(L.links.filter((l) => l.childId === "me").length, 1);
    assert.deepEqual(L.links.find((l) => l.childId === "me")!.parentIds.sort(), ["dad", "mom"]);
    assert.equal(L.marriageLinks.length, 2);
  });
  it("is deterministic regardless of input order", () => {
    const L2 = computeLayout([...people].reverse(), [...edges].reverse(), [...marriages].reverse());
    for (const node of L.nodes) {
      const o = L2.byId.get(node.id)!;
      assert.deepEqual([o.x, o.y], [node.x, node.y], node.id);
    }
  });
  it("handles empty input and single person", () => {
    assert.equal(computeLayout([], [], []).nodes.length, 0);
    assert.equal(computeLayout([P("a")], [], []).nodes.length, 1);
  });
  it("half-siblings from two different partners stay overlap-free", () => {
    const l = computeLayout([P("f", "MALE", 1950), P("m1", "FEMALE", 1952), P("m2", "FEMALE", 1955), P("a", undefined, 1975), P("b", undefined, 1980)],
      [E("f", "a"), E("m1", "a"), E("f", "b"), E("m2", "b")], [M("f", "m1"), M("f", "m2")]);
    assert.equal(l.nodes.length, 5);
    assertNoOverlap(l.nodes);
  });
  it("survives pathological marriage/parent cycles without hanging", () => {
    const l = computeLayout([P("a"), P("b"), P("c")], [E("a", "b"), E("b", "c"), E("c", "a")], [M("a", "c")]);
    assert.equal(l.nodes.length, 3);
  });
});

describe("computeHidden (collapse)", () => {
  it("hides descendants and their spouses but not the collapsed person's own spouse", () => {
    const hidden = computeHidden(new Set(["dad"]), edges, marriages);
    assert.deepEqual([...hidden].sort(), ["me", "sis"]);
    assert.ok(!hidden.has("mom"));
    const hiddenTop = computeHidden(new Set(["grandpa"]), edges, marriages);
    assert.ok(hiddenTop.has("dad") && hiddenTop.has("mom") && hiddenTop.has("me"));
    assert.ok(!hiddenTop.has("grandma") && !hiddenTop.has("grandpa"));
  });
  it("collapsed layout shrinks", () => {
    const hidden = computeHidden(new Set(["grandpa"]), edges, marriages);
    const l = computeLayout(people.filter((p) => !hidden.has(p.id)), edges, marriages);
    assert.equal(l.nodes.length, 2);
  });
});

describe("performance and scale", () => {
  function bigFamily(total: number) {
    const ps: LayoutPerson[] = [], es: LayoutEdge[] = [], ms: LayoutMarriage[] = [];
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const frontier: string[] = [];
    for (let i = 0; i < 20; i++) { ps.push(P(`p${ps.length}`, i % 2 ? "FEMALE" : "MALE", 1800)); frontier.push(`p${ps.length - 1}`); }
    while (ps.length < total) {
      const parent = frontier.shift()!;
      const spouse = `p${ps.length}`; ps.push(P(spouse, "FEMALE", 1800)); ms.push(M(parent, spouse));
      const kids = 1 + Math.floor(rnd() * 3);
      for (let k = 0; k < kids && ps.length < total; k++) {
        const id = `p${ps.length}`; ps.push(P(id, k % 2 ? "FEMALE" : "MALE", 1800 + k));
        es.push(E(parent, id), E(spouse, id)); frontier.push(id);
      }
    }
    return { ps, es, ms };
  }
  for (const size of [10, 100, 1000, 10000]) {
    it(`lays out ${size} people quickly with no overlaps`, () => {
      const { ps, es, ms } = bigFamily(size);
      const t = performance.now();
      const l = computeLayout(ps, es, ms);
      const ms_ = performance.now() - t;
      assert.equal(l.nodes.length, ps.length);
      assertNoOverlap(l.nodes);
      assert.ok(ms_ < 3000, `took ${Math.round(ms_)}ms`);
      console.log(`  layout ${size}: ${Math.round(ms_)}ms`);
    });
  }
});

describe("relationshipLabelUz", () => {
  const g = new FamilyGraph(edges, marriages);
  const byId = new Map(people.map((p) => [p.id, p]));
  const label = (a: string, b: string) =>
    relationshipLabelUz(calculateRelationship(g, a, b), byId.get(a)!, byId.get(b)!, (id) => byId.get(id));
  it("parents, grandparents, spouse, children", () => {
    assert.equal(label("me", "dad"), "ota");
    assert.equal(label("me", "mom"), "ona");
    assert.equal(label("me", "grandpa"), "bobo");
    assert.equal(label("me", "grandma"), "buvi");
    assert.equal(label("dad", "mom"), "xotin");
    assert.equal(label("dad", "me"), "o‘g‘il");
    assert.equal(label("grandpa", "me"), "nevara");
  });
  it("siblings by age and uncle by father's side", () => {
    assert.equal(label("me", "sis"), "singil");
    assert.equal(label("sis", "me"), "aka");
    assert.equal(label("me", "uncle"), "amaki");
  });
});
