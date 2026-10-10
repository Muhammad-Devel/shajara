/** Authorization rules (pure functions, no database). One place decides who may do what. */

export type FamilyRole = "OWNER" | "ADMIN" | "EDITOR" | "CONTRIBUTOR" | "VIEWER";
export type Visibility = "PRIVATE" | "SELECTED" | "FAMILY" | "PUBLIC";

export type Action =
  | "family:view"
  | "family:update"
  | "family:delete"
  | "member:manage"
  | "person:create"
  | "person:update" // CONTRIBUTOR: only persons they created (see canModifyPerson)
  | "person:delete" // CONTRIBUTOR: only persons they created
  | "relation:manage";

const VIEW: Action[] = ["family:view"];
const CONTRIBUTE: Action[] = [...VIEW, "person:create"];
const EDIT: Action[] = [...CONTRIBUTE, "person:update", "person:delete", "relation:manage"];
const ADMIN: Action[] = [...EDIT, "family:update", "member:manage"];
const OWNER: Action[] = [...ADMIN, "family:delete"];

const MATRIX: Record<FamilyRole, ReadonlySet<Action>> = {
  VIEWER: new Set(VIEW),
  CONTRIBUTOR: new Set(CONTRIBUTE),
  EDITOR: new Set(EDIT),
  ADMIN: new Set(ADMIN),
  OWNER: new Set(OWNER),
};

export function can(role: FamilyRole, action: Action): boolean {
  return MATRIX[role].has(action);
}

/** Editing/deleting an existing person: EDITOR and above always; CONTRIBUTOR only what they created. */
export function canModifyPerson(role: FamilyRole, userId: string, createdById: string | null): boolean {
  if (can(role, "person:update")) return true;
  return role === "CONTRIBUTOR" && createdById !== null && createdById === userId;
}

/**
 * Who can see a person (MVP rule):
 * - PUBLIC / FAMILY: every family member.
 * - PRIVATE (default for living people): the creator, family OWNER and ADMIN.
 * - SELECTED: treated like PRIVATE until per-person access lists (ContentAccess) are implemented.
 */
export function canViewPerson(args: {
  role: FamilyRole;
  userId: string;
  visibility: Visibility;
  createdById: string | null;
}): boolean {
  const { role, userId, visibility, createdById } = args;
  if (visibility === "PUBLIC" || visibility === "FAMILY") return true;
  if (role === "OWNER" || role === "ADMIN") return true;
  return createdById !== null && createdById === userId;
}

// ---- membership & invitations ----

export const INVITATION_TTL_DAYS = 7;
export const MAX_MEMBERS_PER_FAMILY = 50;
export const MAX_PENDING_INVITATIONS = 50;
/** Roles that can be given through an invitation (OWNER is never granted). */
export const INVITABLE_ROLES = ["VIEWER", "CONTRIBUTOR", "EDITOR", "ADMIN"] as const;

/** May `actor` hand out `newRole` (invitation or role change)? Only the OWNER can create ADMINs. */
export function canGrantRole(actor: FamilyRole, newRole: FamilyRole): boolean {
  if (!can(actor, "member:manage")) return false;
  if (newRole === "OWNER") return false;
  if (newRole === "ADMIN") return actor === "OWNER";
  return true;
}

/** May `actor` change an existing member (currently `target`) to `newRole`? The OWNER's role never changes. */
export function canChangeRole(actor: FamilyRole, target: FamilyRole, newRole: FamilyRole): boolean {
  if (!canGrantRole(actor, newRole)) return false;
  if (target === "OWNER") return false;
  if (target === "ADMIN") return actor === "OWNER";
  return true;
}

/** Anyone may leave; admins remove people below them; only the OWNER removes admins; the OWNER cannot be removed. */
export function canRemoveMember(args: { actor: FamilyRole; actorId: string; target: FamilyRole; targetId: string }): boolean {
  const { actor, actorId, target, targetId } = args;
  if (target === "OWNER") return false;
  if (actorId === targetId) return true;
  if (!can(actor, "member:manage")) return false;
  if (target === "ADMIN") return actor === "OWNER";
  return true;
}

export function invitationUsable(inv: { status: string; expiresAt: Date }, now: Date): boolean {
  return inv.status === "PENDING" && inv.expiresAt.getTime() > now.getTime();
}
