import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FamilyGraph,
  ValidationCode,
  calculateRelationship,
  validateMarriage,
  validateParentChild,
  validatePersonDates,
  type PersonLite,
} from "../src/index.ts";

const people = (...list: PersonLite[]) => new Map(list.map((p) => [p.id, p]));
const p = (id: string, birthDate?: string, deathDate?: string): PersonLite => ({ id, birthDate, deathDate });

// Family used in relationship tests:
// grandpa ─┬─ dad ─── me
//          ├─ uncle ── cousin ── cousinKid
//          └─ auntie (not related below)
// grandpa2 ─ uncle2? (second cousin line)
// greatGrandpa ─┬─ grandpa ─┬─ dad, uncle
//               └─ grandpaBro ── cousinDad ── secondCousin
const edges = [
  ["greatGrandpa", "grandpa"],
  ["greatGrandpa", "grandpaBro"],
  ["grandpa", "dad"],
  ["grandpa", "uncle"],
  ["dad", "me"],
  ["uncle", "cousin"],
  ["cousin", "cousinKid"],
  ["grandpaBro", "cousinDad"],
  ["cousinDad", "secondCousin"],
  ["dad", "halfSis"],
  ["otherMom", "halfSis"],
  ["mom", "me"],
  ["mom", "fullSis"],
  ["dad", "fullSis"],
  ["grandpa", "niece_parent"],
  ["niece_parent", "niece"],
].map(([parentId, childId]) => ({ parentId: parentId as string, childId: childId as string }));
const graph = new FamilyGraph(edges, [{ personAId: "dad", personBId: "mom" }]);

describe("relationship engine", () => {
  it("self and spouse", () => {
    assert.equal(calculateRelationship(graph, "me", "me").kind, "self");
    assert.equal(calculateRelationship(graph, "dad", "mom").kind, "spouse");
  });
  it("parent / grandparent (B is A's ancestor)", () => {
    assert.deepEqual(calculateRelationship(graph, "me", "dad"), {
      kind: "ancestor", generations: 1, path: ["me", "dad"],
    });
    const gp = calculateRelationship(graph, "me", "grandpa");
    assert.equal(gp.kind, "ancestor");
    assert.equal(gp.generations, 2);
    assert.deepEqual(gp.path, ["me", "dad", "grandpa"]);
  });
  it("child / grandchild", () => {
    const r = calculateRelationship(graph, "grandpa", "me");
    assert.equal(r.kind, "descendant");
    assert.equal(r.generations, 2);
  });
  it("full vs half sibling", () => {
    assert.equal(calculateRelationship(graph, "me", "fullSis").half, false);
    const half = calculateRelationship(graph, "me", "halfSis");
    assert.equal(half.kind, "sibling");
    assert.equal(half.half, true);
  });
  it("uncle and niece", () => {
    const u = calculateRelationship(graph, "me", "uncle");
    assert.equal(u.kind, "uncle_aunt");
    assert.equal(u.generations, 2);
    assert.deepEqual(u.path, ["me", "dad", "grandpa", "uncle"]);
    const n = calculateRelationship(graph, "dad", "niece");
    assert.equal(n.kind, "niece_nephew");
    assert.equal(n.generations, 2);
  });
  it("first cousin, first cousin once removed, second cousin", () => {
    const c1 = calculateRelationship(graph, "me", "cousin");
    assert.deepEqual([c1.kind, c1.degree, c1.removed], ["cousin", 1, 0]);
    const c1r = calculateRelationship(graph, "me", "cousinKid");
    assert.deepEqual([c1r.kind, c1r.degree, c1r.removed], ["cousin", 1, 1]);
    const c2 = calculateRelationship(graph, "me", "secondCousin");
    assert.deepEqual([c2.kind, c2.degree, c2.removed], ["cousin", 2, 0]);
  });
  it("unrelated people", () => {
    assert.equal(calculateRelationship(graph, "me", "stranger").kind, "none");
  });
});

describe("validation", () => {
  const ppl = people(p("a", "1950"), p("b", "1975"), p("c", "2000"));

  it("rejects self parent", () => {
    const r = validateParentChild(new FamilyGraph(), ppl, { parentId: "a", childId: "a" });
    assert.deepEqual(r.ok === false && r.code, ValidationCode.SelfParent);
  });
  it("rejects duplicates", () => {
    const g = new FamilyGraph([{ parentId: "a", childId: "b" }]);
    const r = validateParentChild(g, ppl, { parentId: "a", childId: "b" });
    assert.equal(r.ok === false && r.code, ValidationCode.DuplicateRelationship);
  });
  it("rejects cycles A→B→C→A", () => {
    const g = new FamilyGraph([
      { parentId: "a", childId: "b" },
      { parentId: "b", childId: "c" },
    ]);
    const r = validateParentChild(g, ppl, { parentId: "c", childId: "a" });
    assert.equal(r.ok === false && r.code, ValidationCode.CycleDetected);
  });
  it("rejects parent born after child", () => {
    const r = validateParentChild(new FamilyGraph(), ppl, { parentId: "c", childId: "b" });
    assert.equal(r.ok === false && r.code, ValidationCode.ParentYoungerThanChild);
  });
  it("allows ambiguous partial dates (same year)", () => {
    const same = people(p("x", "1980"), p("y", "1980"));
    assert.equal(validateParentChild(new FamilyGraph(), same, { parentId: "x", childId: "y" }).ok, true);
  });
  it("rejects parent who died long before child's birth", () => {
    const d = people(p("dad", "1900", "1930"), p("kid", "1940"));
    const r = validateParentChild(new FamilyGraph(), d, { parentId: "dad", childId: "kid" });
    assert.equal(r.ok === false && r.code, ValidationCode.ParentDiedBeforeChildConceived);
  });
  it("allows posthumous child within pregnancy window", () => {
    const d = people(p("dad", "1900", "1930-01-01"), p("kid", "1930-08-01"));
    assert.equal(validateParentChild(new FamilyGraph(), d, { parentId: "dad", childId: "kid" }).ok, true);
  });
  it("accepts a valid edge", () => {
    assert.equal(validateParentChild(new FamilyGraph(), ppl, { parentId: "a", childId: "b" }).ok, true);
  });
  it("marriage rules", () => {
    const g = new FamilyGraph([{ parentId: "a", childId: "b" }], [{ personAId: "b", personBId: "c" }]);
    const self = validateMarriage(g, ppl, { personAId: "a", personBId: "a" });
    assert.equal(self.ok === false && self.code, ValidationCode.SelfMarriage);
    const dup = validateMarriage(g, ppl, { personAId: "c", personBId: "b" });
    assert.equal(dup.ok === false && dup.code, ValidationCode.DuplicateRelationship);
    const line = validateMarriage(g, ppl, { personAId: "a", personBId: "b" });
    assert.equal(line.ok === false && line.code, ValidationCode.MarriageInDirectLine);
  });
  it("person date sanity", () => {
    assert.equal(validatePersonDates(p("z", "1990-02-31")).ok, false);
    const r = validatePersonDates(p("z", "1990", "1980"));
    assert.equal(r.ok === false && r.code, ValidationCode.DeathBeforeBirth);
    assert.equal(validatePersonDates(p("z", "1990", "1990")).ok, true);
  });
});
