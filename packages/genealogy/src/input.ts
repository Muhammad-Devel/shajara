import { parsePartialDate } from "./dates.ts";
import { validatePersonDates } from "./validation.ts";

export type FieldErrors = Record<string, string>;
export type ParsedInput<T> = { ok: true; value: T } | { ok: false; errors: FieldErrors };

export const GENDERS = ["MALE", "FEMALE", "OTHER", "UNKNOWN"] as const;
export const VISIBILITIES = ["PRIVATE", "SELECTED", "FAMILY", "PUBLIC"] as const;
export const PARENT_CHILD_TYPES = ["BIOLOGICAL", "ADOPTED", "STEP", "FOSTER"] as const;
export const MARRIAGE_STATUSES = ["MARRIED", "DIVORCED", "WIDOWED"] as const;
export type Gender = (typeof GENDERS)[number];
export type PersonVisibility = (typeof VISIBILITIES)[number];
export type ParentChildType = (typeof PARENT_CHILD_TYPES)[number];
export type MarriageStatus = (typeof MARRIAGE_STATUSES)[number];

const NAME_MAX = 80;
const BIO_MAX = 2000;
const ID_MAX = 64;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
/** Empty string and missing are treated the same: "not provided". */
const present = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === "string" && (list as readonly string[]).includes(v);
const result = <T>(errors: FieldErrors, value: T): ParsedInput<T> => (Object.keys(errors).length ? { ok: false, errors } : { ok: true, value });
const BAD_BODY: ParsedInput<never> = { ok: false, errors: { _: "BODY_INVALID" } };

function optionalText(obj: Record<string, unknown>, key: string, max: number, code: string, errors: FieldErrors): string | null {
  const v = obj[key];
  if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) return null;
  if (typeof v !== "string") { errors[key] = code; return null; }
  const t = v.trim().replace(/[ \t]+/g, " ");
  if (t.length > max) errors[key] = code;
  return t;
}

function optionalDate(obj: Record<string, unknown>, key: string, errors: FieldErrors): string | null {
  const v = obj[key];
  if (!present(v)) return null;
  const t = v.trim();
  if (parsePartialDate(t) === null) { errors[key] = "DATE_INVALID"; return null; }
  return t;
}

export interface PersonInput {
  firstName: string;
  lastName: string | null;
  maidenName: string | null;
  gender: Gender;
  birthDate: string | null;
  deathDate: string | null;
  isLiving: boolean;
  bio: string | null;
  visibility: PersonVisibility;
}

/** Validates and normalizes a person. Living people default to PRIVATE (privacy by design). */
export function parsePersonInput(input: unknown): ParsedInput<PersonInput> {
  if (!isObject(input)) return BAD_BODY;
  const errors: FieldErrors = {};

  const firstName = (typeof input.firstName === "string" ? input.firstName : "").trim().replace(/\s+/g, " ");
  if (firstName.length < 1 || firstName.length > NAME_MAX) errors.firstName = "NAME_INVALID";
  const lastName = optionalText(input, "lastName", NAME_MAX, "NAME_INVALID", errors);
  const maidenName = optionalText(input, "maidenName", NAME_MAX, "NAME_INVALID", errors);
  const bio = optionalText(input, "bio", BIO_MAX, "BIO_TOO_LONG", errors);

  let gender: Gender = "UNKNOWN";
  if (present(input.gender)) {
    if (oneOf(GENDERS, input.gender)) gender = input.gender;
    else errors.gender = "GENDER_INVALID";
  }

  const birthDate = optionalDate(input, "birthDate", errors);
  const deathDate = optionalDate(input, "deathDate", errors);
  if (!errors.birthDate && !errors.deathDate) {
    const dates = validatePersonDates({ id: "x", birthDate, deathDate });
    if (!dates.ok) errors.deathDate = dates.code;
  }

  let isLiving = deathDate === null;
  if (typeof input.isLiving === "boolean") {
    if (input.isLiving && deathDate !== null) errors.isLiving = "LIVING_WITH_DEATH_DATE";
    else isLiving = input.isLiving;
  }

  let visibility: PersonVisibility = isLiving ? "PRIVATE" : "FAMILY";
  if (present(input.visibility)) {
    if (oneOf(VISIBILITIES, input.visibility)) visibility = input.visibility;
    else errors.visibility = "VISIBILITY_INVALID";
  }

  return result(errors, { firstName, lastName, maidenName, gender, birthDate, deathDate, isLiving, bio, visibility });
}

/**
 * Partial update: merges the patch onto the existing person, then validates the merged result.
 * Setting a death date without mentioning `isLiving` marks the person as not living.
 */
export function parsePersonPatch(input: unknown, existing: PersonInput): ParsedInput<PersonInput> {
  if (!isObject(input)) return BAD_BODY;
  const keys = ["firstName", "lastName", "maidenName", "gender", "birthDate", "deathDate", "isLiving", "bio", "visibility"] as const;
  const merged: Record<string, unknown> = { ...existing };
  for (const k of keys) if (k in input) merged[k] = input[k];
  if (present(input.deathDate) && !("isLiving" in input)) merged.isLiving = false;
  return parsePersonInput(merged);
}

export interface FamilyInput { name: string; description: string | null }

export function parseFamilyInput(input: unknown): ParsedInput<FamilyInput> {
  if (!isObject(input)) return BAD_BODY;
  const errors: FieldErrors = {};
  const name = (typeof input.name === "string" ? input.name : "").trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > 100) errors.name = "NAME_INVALID";
  const description = optionalText(input, "description", 500, "DESCRIPTION_TOO_LONG", errors);
  return result(errors, { name, description });
}

function idField(obj: Record<string, unknown>, key: string, errors: FieldErrors): string {
  const v = obj[key];
  if (typeof v !== "string" || v.length < 1 || v.length > ID_MAX) { errors[key] = "ID_INVALID"; return ""; }
  return v;
}

export function parseParentChildInput(input: unknown): ParsedInput<{ parentId: string; childId: string; type: ParentChildType }> {
  if (!isObject(input)) return BAD_BODY;
  const errors: FieldErrors = {};
  const parentId = idField(input, "parentId", errors);
  const childId = idField(input, "childId", errors);
  let type: ParentChildType = "BIOLOGICAL";
  if (present(input.type)) {
    if (oneOf(PARENT_CHILD_TYPES, input.type)) type = input.type;
    else errors.type = "TYPE_INVALID";
  }
  return result(errors, { parentId, childId, type });
}

export interface MarriageInput {
  personAId: string; personBId: string; status: MarriageStatus; startDate: string | null; endDate: string | null;
}

export function parseMarriageInput(input: unknown): ParsedInput<MarriageInput> {
  if (!isObject(input)) return BAD_BODY;
  const errors: FieldErrors = {};
  const personAId = idField(input, "personAId", errors);
  const personBId = idField(input, "personBId", errors);
  let status: MarriageStatus = "MARRIED";
  if (present(input.status)) {
    if (oneOf(MARRIAGE_STATUSES, input.status)) status = input.status;
    else errors.status = "STATUS_INVALID";
  }
  const startDate = optionalDate(input, "startDate", errors);
  const endDate = optionalDate(input, "endDate", errors);
  if (startDate && endDate && !errors.startDate && !errors.endDate) {
    const s = parsePartialDate(startDate), e = parsePartialDate(endDate);
    if (s !== null && e !== null && e < s) errors.endDate = "DATE_ORDER_INVALID";
  }
  return result(errors, { personAId, personBId, status, startDate, endDate });
}
