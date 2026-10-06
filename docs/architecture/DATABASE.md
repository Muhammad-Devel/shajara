# Database design notes

Process followed: entities → relationships → cardinality → constraints → indexes → privacy.

- **Sibling** is derived from shared parents (no table). **Half-sibling** = one shared parent.
- **Marriage** pair stored once (`personAId < personBId`, enforced in service + SQL CHECK).
- **ParentChild** unique (parentId, childId); SQL `CHECK (parentId <> childId)`; cycle check in `@shajara/genealogy` inside the creating transaction.
- **Indexes:** Person(familyId), (familyId,lastName,firstName), birthYear; ParentChild(childId); Event(personId,year); Notification(userId,readAt,createdAt); AuditLog(familyId,createdAt).
- **Raw SQL migration TODO:** generated `tsvector` column + GIN index on Person names; CHECK constraints above.
- **Future-ready:** `Person.verification` (UNVERIFIED/VERIFIED/DISPUTED); Source/Evidence tables added post-MVP.
- **Not validated yet:** schema was written offline; run `npm run db:validate` first.

## Open question for the product owner
A person appearing in two different families (e.g. two cousins both adding "Grandpa") is currently two Person rows. Merging/linking across families = the "possible duplicate / possible connection" feature (post-MVP, always user-confirmed).
