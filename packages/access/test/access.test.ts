import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { can, canModifyPerson, canViewPerson, type FamilyRole } from "../src/index.ts";

describe("role permissions", () => {
  it("viewer can only view", () => {
    assert.equal(can("VIEWER", "family:view"), true);
    for (const a of ["person:create", "person:update", "relation:manage", "family:update", "family:delete", "member:manage"] as const) {
      assert.equal(can("VIEWER", a), false, a);
    }
  });
  it("contributor can add people but not relations", () => {
    assert.equal(can("CONTRIBUTOR", "person:create"), true);
    assert.equal(can("CONTRIBUTOR", "relation:manage"), false);
  });
  it("editor edits people and relations, not the family itself", () => {
    assert.equal(can("EDITOR", "relation:manage"), true);
    assert.equal(can("EDITOR", "person:delete"), true);
    assert.equal(can("EDITOR", "family:update"), false);
  });
  it("only owner deletes the family", () => {
    const roles: FamilyRole[] = ["VIEWER", "CONTRIBUTOR", "EDITOR", "ADMIN", "OWNER"];
    assert.deepEqual(roles.filter((r) => can(r, "family:delete")), ["OWNER"]);
    assert.deepEqual(roles.filter((r) => can(r, "member:manage")), ["ADMIN", "OWNER"]);
  });
});

describe("canModifyPerson", () => {
  it("contributor only their own persons", () => {
    assert.equal(canModifyPerson("CONTRIBUTOR", "u1", "u1"), true);
    assert.equal(canModifyPerson("CONTRIBUTOR", "u1", "u2"), false);
    assert.equal(canModifyPerson("CONTRIBUTOR", "u1", null), false);
  });
  it("editor any person; viewer none", () => {
    assert.equal(canModifyPerson("EDITOR", "u1", "u2"), true);
    assert.equal(canModifyPerson("VIEWER", "u1", "u1"), false);
  });
});

describe("canViewPerson", () => {
  const base = { userId: "u1", createdById: "u2" };
  it("family/public visible to every member", () => {
    assert.equal(canViewPerson({ ...base, role: "VIEWER", visibility: "FAMILY" }), true);
    assert.equal(canViewPerson({ ...base, role: "VIEWER", visibility: "PUBLIC" }), true);
  });
  it("private only for creator, owner, admin", () => {
    assert.equal(canViewPerson({ ...base, role: "EDITOR", visibility: "PRIVATE" }), false);
    assert.equal(canViewPerson({ ...base, role: "VIEWER", visibility: "PRIVATE" }), false);
    assert.equal(canViewPerson({ ...base, role: "ADMIN", visibility: "PRIVATE" }), true);
    assert.equal(canViewPerson({ ...base, role: "OWNER", visibility: "PRIVATE" }), true);
    assert.equal(canViewPerson({ userId: "u1", createdById: "u1", role: "CONTRIBUTOR", visibility: "PRIVATE" }), true);
  });
  it("selected behaves as private for now", () => {
    assert.equal(canViewPerson({ ...base, role: "EDITOR", visibility: "SELECTED" }), false);
  });
});
