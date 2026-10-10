import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseFamilyInput, parseMarriageInput, parseParentChildInput, parsePersonInput, parsePersonPatch,
  validateParentChildDates,
} from "../src/index.ts";

describe("parsePersonInput", () => {
  it("applies privacy defaults: living → PRIVATE, deceased → FAMILY", () => {
    const living = parsePersonInput({ firstName: "Ali" });
    assert.ok(living.ok);
    assert.equal(living.value.isLiving, true);
    assert.equal(living.value.visibility, "PRIVATE");
    assert.equal(living.value.gender, "UNKNOWN");
    const dead = parsePersonInput({ firstName: "Hasan", deathDate: "1990" });
    assert.ok(dead.ok);
    assert.equal(dead.value.isLiving, false);
    assert.equal(dead.value.visibility, "FAMILY");
  });
  it("treats empty strings as not provided and trims", () => {
    const r = parsePersonInput({ firstName: "  Ali  Vali ", lastName: "", birthDate: "", visibility: "" });
    assert.ok(r.ok);
    assert.equal(r.value.firstName, "Ali Vali");
    assert.equal(r.value.lastName, null);
    assert.equal(r.value.birthDate, null);
  });
  it("reports field errors", () => {
    const r = parsePersonInput({ firstName: "", gender: "X", birthDate: "1990-13-01", visibility: "ALL", bio: "x".repeat(2001) });
    assert.equal(r.ok, false);
    if (!r.ok) assert.deepEqual(r.errors, {
      firstName: "NAME_INVALID", bio: "BIO_TOO_LONG", gender: "GENDER_INVALID", birthDate: "DATE_INVALID", visibility: "VISIBILITY_INVALID",
    });
  });
  it("rejects death before birth and living with death date", () => {
    const a = parsePersonInput({ firstName: "A", birthDate: "2000", deathDate: "1990" });
    assert.ok(!a.ok && a.errors.deathDate === "DEATH_BEFORE_BIRTH");
    const b = parsePersonInput({ firstName: "A", deathDate: "1990", isLiving: true });
    assert.ok(!b.ok && b.errors.isLiving === "LIVING_WITH_DEATH_DATE");
  });
  it("rejects non-object", () => {
    assert.equal(parsePersonInput("x").ok, false);
  });
});

describe("parsePersonPatch", () => {
  const existing = { firstName: "Ali", lastName: "Valiyev", maidenName: null, gender: "MALE" as const, birthDate: "1950", deathDate: null, isLiving: true, bio: null, visibility: "PRIVATE" as const };
  it("keeps untouched fields and updates the given ones", () => {
    const r = parsePersonPatch({ lastName: "Karimov" }, existing);
    assert.ok(r.ok);
    assert.equal(r.value.lastName, "Karimov");
    assert.equal(r.value.birthDate, "1950");
    assert.equal(r.value.visibility, "PRIVATE");
  });
  it("setting a death date marks the person as not living", () => {
    const r = parsePersonPatch({ deathDate: "2020" }, existing);
    assert.ok(r.ok);
    assert.equal(r.value.isLiving, false);
  });
  it("can clear a field with an empty value", () => {
    const r = parsePersonPatch({ birthDate: "" }, existing);
    assert.ok(r.ok);
    assert.equal(r.value.birthDate, null);
  });
  it("validates the merged result", () => {
    const r = parsePersonPatch({ deathDate: "1900" }, existing);
    assert.ok(!r.ok && r.errors.deathDate === "DEATH_BEFORE_BIRTH");
  });
});

describe("relation and family inputs", () => {
  it("parent-child defaults to BIOLOGICAL and checks ids/type", () => {
    const r = parseParentChildInput({ parentId: "a", childId: "b" });
    assert.ok(r.ok);
    assert.equal(r.value.type, "BIOLOGICAL");
    assert.equal(parseParentChildInput({ parentId: "a" }).ok, false);
    assert.equal(parseParentChildInput({ parentId: "a", childId: "b", type: "X" }).ok, false);
  });
  it("marriage checks status and date order", () => {
    assert.ok(parseMarriageInput({ personAId: "a", personBId: "b", startDate: "1970", endDate: "1990", status: "DIVORCED" }).ok);
    const bad = parseMarriageInput({ personAId: "a", personBId: "b", startDate: "1990", endDate: "1970" });
    assert.ok(!bad.ok && bad.errors.endDate === "DATE_ORDER_INVALID");
  });
  it("family name required, description limited", () => {
    assert.ok(parseFamilyInput({ name: " Karimovlar " }).ok);
    assert.equal(parseFamilyInput({ name: "" }).ok, false);
    assert.equal(parseFamilyInput({ name: "A", description: "x".repeat(501) }).ok, false);
  });
});

describe("validateParentChildDates (reused when editing dates)", () => {
  it("detects a parent younger than the child", () => {
    const r = validateParentChildDates({ id: "p", birthDate: "2000" }, { id: "c", birthDate: "1990" });
    assert.equal(r.ok, false);
  });
  it("accepts consistent dates", () => {
    assert.equal(validateParentChildDates({ id: "p", birthDate: "1960" }, { id: "c", birthDate: "1990" }).ok, true);
  });
});
