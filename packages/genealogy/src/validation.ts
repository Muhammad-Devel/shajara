import { DAY_MS, latestInstant, parsePartialDate } from "./dates.ts";
import type { FamilyGraph } from "./graph.ts";
import {
  ValidationCode,
  type MarriageEdge,
  type ParentChildEdge,
  type PersonLite,
  type ValidationResult,
} from "./types.ts";

/** Pregnancy tolerance: a father may die shortly before birth. Applied to both parents to stay simple and permissive. */
const MAX_DEATH_BEFORE_BIRTH_DAYS = 300;

const OK: ValidationResult = { ok: true };
const fail = (code: ValidationCode, message: string): ValidationResult => ({ ok: false, code, message });

export function validatePersonDates(p: PersonLite): ValidationResult {
  if (p.birthDate && parsePartialDate(p.birthDate) === null) {
    return fail(ValidationCode.InvalidDate, `Birth date "${p.birthDate}" is not valid.`);
  }
  if (p.deathDate && parsePartialDate(p.deathDate) === null) {
    return fail(ValidationCode.InvalidDate, `Death date "${p.deathDate}" is not valid.`);
  }
  const birth = parsePartialDate(p.birthDate);
  const deathLatest = latestInstant(p.deathDate);
  if (birth !== null && deathLatest !== null && deathLatest < birth) {
    return fail(ValidationCode.DeathBeforeBirth, "Death date cannot be earlier than birth date.");
  }
  return OK;
}

export function validateParentChild(
  graph: FamilyGraph,
  people: ReadonlyMap<string, PersonLite>,
  edge: ParentChildEdge,
): ValidationResult {
  const { parentId, childId } = edge;
  if (parentId === childId) {
    return fail(ValidationCode.SelfParent, "A person cannot be their own parent or child.");
  }
  const parent = people.get(parentId);
  const child = people.get(childId);
  if (!parent || !child) return fail(ValidationCode.PersonNotFound, "Person not found.");

  if (graph.hasParentChild(parentId, childId)) {
    return fail(ValidationCode.DuplicateRelationship, "This parent-child relationship already exists.");
  }
  // Cycle: the new child must not already be an ancestor of the new parent (A → B → C → A).
  if (graph.isAncestor(childId, parentId)) {
    return fail(
      ValidationCode.CycleDetected,
      "This would create a circular family line: the child is already an ancestor of the parent.",
    );
  }

  // Only flag when certain regardless of date precision: parent's earliest possible birth
  // is not before the child's latest possible birth.
  const parentBirthEarliest = parsePartialDate(parent.birthDate);
  const childBirthLatest = latestInstant(child.birthDate);
  if (parentBirthEarliest !== null && childBirthLatest !== null && parentBirthEarliest >= childBirthLatest) {
    return fail(ValidationCode.ParentYoungerThanChild, "A parent must be born before their child.");
  }
  const parentDeathLatest = latestInstant(parent.deathDate);
  const childBirthEarliest = parsePartialDate(child.birthDate);
  if (parentDeathLatest !== null && childBirthEarliest !== null) {
    if (childBirthEarliest - parentDeathLatest > MAX_DEATH_BEFORE_BIRTH_DAYS * DAY_MS) {
      return fail(
        ValidationCode.ParentDiedBeforeChildConceived,
        "The parent died too long before the child was born.",
      );
    }
  }
  return OK;
}

export function validateMarriage(
  graph: FamilyGraph,
  people: ReadonlyMap<string, PersonLite>,
  edge: MarriageEdge,
): ValidationResult {
  const { personAId: a, personBId: b } = edge;
  if (a === b) return fail(ValidationCode.SelfMarriage, "A person cannot marry themselves.");
  if (!people.has(a) || !people.has(b)) return fail(ValidationCode.PersonNotFound, "Person not found.");
  if (graph.hasMarriage(a, b)) {
    return fail(ValidationCode.DuplicateRelationship, "These two people are already married.");
  }
  if (graph.isAncestor(a, b) || graph.isAncestor(b, a)) {
    return fail(ValidationCode.MarriageInDirectLine, "A person cannot marry their own ancestor or descendant.");
  }
  return OK;
}
