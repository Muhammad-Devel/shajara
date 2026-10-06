export type PersonId = string;

/** Minimal person data the genealogy engine needs. Dates are ISO, partial allowed: "1950", "1950-03", "1950-03-17". */
export interface PersonLite {
  id: PersonId;
  birthDate?: string | null;
  deathDate?: string | null;
}

export interface ParentChildEdge {
  parentId: PersonId;
  childId: PersonId;
}

export interface MarriageEdge {
  personAId: PersonId;
  personBId: PersonId;
}

export const ValidationCode = {
  PersonNotFound: "PERSON_NOT_FOUND",
  SelfParent: "SELF_PARENT",
  SelfMarriage: "SELF_MARRIAGE",
  DuplicateRelationship: "DUPLICATE_RELATIONSHIP",
  CycleDetected: "CYCLE_DETECTED",
  InvalidDate: "INVALID_DATE",
  DeathBeforeBirth: "DEATH_BEFORE_BIRTH",
  ParentYoungerThanChild: "PARENT_YOUNGER_THAN_CHILD",
  ParentDiedBeforeChildConceived: "PARENT_DIED_BEFORE_CHILD_CONCEIVED",
  MarriageInDirectLine: "MARRIAGE_IN_DIRECT_LINE",
} as const;
export type ValidationCode = (typeof ValidationCode)[keyof typeof ValidationCode];

export type ValidationResult =
  | { ok: true }
  | { ok: false; code: ValidationCode; message: string };
