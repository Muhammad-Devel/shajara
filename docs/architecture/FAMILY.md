# Family & Person (Phase 5)

## Roles → actions
| Role | view | add person | edit/delete person | manage relations | edit family | manage members | delete family |
|---|---|---|---|---|---|---|---|
| VIEWER | ✓ | | | | | | |
| CONTRIBUTOR | ✓ | ✓ | own only | | | | |
| EDITOR | ✓ | ✓ | ✓ | ✓ | | | |
| ADMIN | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| OWNER | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

Source of truth: `packages/access` (pure, tested). Routes never inline role checks.

## Visibility (MVP rule)
FAMILY/PUBLIC → every member. PRIVATE (default for living people) → creator, OWNER, ADMIN. SELECTED behaves as PRIVATE until `ContentAccess` lists are wired. Hidden people and links to them are removed from every response; non-members get 404 (existence is not revealed).

## Integrity
- Parent/child and marriage creation run in a **Serializable** transaction using the genealogy engine: self-link, duplicate, **cycle**, parent-younger-than-child, parent-died-too-early, marriage in direct line, max 2 biological parents.
- Editing dates re-checks every existing parent/child link of that person.
- Deleting a person is a soft delete; the person linked to an account cannot be deleted.
- Family creation adds the creator as OWNER and as a Person ("add yourself").

## API
`POST/GET /families`, `GET/PATCH/DELETE /families/:id`, `GET /families/:id/tree`,
`POST /persons`, `GET/PATCH/DELETE /persons/:id`, `GET /persons/:id/relatives`,
`GET /persons/:id/relationship/:targetId`, `POST /parent-child`, `DELETE /parent-child/:id`,
`POST /marriages`, `DELETE /marriages/:id`.

## Not yet
Invitations and member management (so only OWNER is exercisable end-to-end), tree visualization, search, media, stories.
