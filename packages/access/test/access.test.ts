import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  can, canChangeRole, canGrantRole, canModifyPerson, canRemoveMember, canViewPerson, invitationUsable, type FamilyRole,
} from "../src/index.ts";

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

describe("granting and changing roles", () => {
  it("only OWNER can create admins; nobody can create owners", () => {
    assert.equal(canGrantRole("OWNER", "ADMIN"), true);
    assert.equal(canGrantRole("ADMIN", "ADMIN"), false);
    assert.equal(canGrantRole("OWNER", "OWNER"), false);
    assert.equal(canGrantRole("ADMIN", "EDITOR"), true);
  });
  it("members without member:manage grant nothing", () => {
    for (const r of ["VIEWER", "CONTRIBUTOR", "EDITOR"] as const) assert.equal(canGrantRole(r, "VIEWER"), false, r);
  });
  it("owner role is untouchable; admins only changed by owner", () => {
    assert.equal(canChangeRole("OWNER", "OWNER", "VIEWER"), false);
    assert.equal(canChangeRole("ADMIN", "ADMIN", "VIEWER"), false);
    assert.equal(canChangeRole("OWNER", "ADMIN", "VIEWER"), true);
    assert.equal(canChangeRole("ADMIN", "VIEWER", "EDITOR"), true);
    assert.equal(canChangeRole("ADMIN", "VIEWER", "ADMIN"), false);
  });
});

describe("removing members", () => {
  it("anyone may leave, except the owner", () => {
    assert.equal(canRemoveMember({ actor: "VIEWER", actorId: "a", target: "VIEWER", targetId: "a" }), true);
    assert.equal(canRemoveMember({ actor: "OWNER", actorId: "a", target: "OWNER", targetId: "a" }), false);
  });
  it("viewers cannot remove others; admins cannot remove admins or the owner", () => {
    assert.equal(canRemoveMember({ actor: "EDITOR", actorId: "a", target: "VIEWER", targetId: "b" }), false);
    assert.equal(canRemoveMember({ actor: "ADMIN", actorId: "a", target: "ADMIN", targetId: "b" }), false);
    assert.equal(canRemoveMember({ actor: "ADMIN", actorId: "a", target: "OWNER", targetId: "b" }), false);
    assert.equal(canRemoveMember({ actor: "ADMIN", actorId: "a", target: "EDITOR", targetId: "b" }), true);
    assert.equal(canRemoveMember({ actor: "OWNER", actorId: "a", target: "ADMIN", targetId: "b" }), true);
  });
});

describe("invitationUsable", () => {
  const now = new Date("2026-10-10T12:00:00Z");
  it("pending and unexpired only", () => {
    assert.equal(invitationUsable({ status: "PENDING", expiresAt: new Date("2026-10-11T00:00:00Z") }, now), true);
    assert.equal(invitationUsable({ status: "PENDING", expiresAt: new Date("2026-10-10T11:59:59Z") }, now), false);
    for (const status of ["ACCEPTED", "REVOKED", "EXPIRED"]) {
      assert.equal(invitationUsable({ status, expiresAt: new Date("2030-01-01T00:00:00Z") }, now), false, status);
    }
  });
});
