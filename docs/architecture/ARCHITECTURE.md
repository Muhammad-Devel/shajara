# Architecture

```
Client (Web/PWA, later Expo)
  → Next.js on Vercel (UI + /api/v1)
    → Modules: auth · family · genealogy · media · privacy · admin
      → PostgreSQL (Prisma)   → Redis (later)
      → S3-compatible storage (presigned uploads)
```

## Decisions (ADR summary)
1. **Modular monolith in Next.js**, no NestJS for MVP. Modules talk only through service interfaces, so extraction to a separate API (needed for mobile) is mechanical. Revisit when mobile starts.
2. **Genealogy engine is a pure TypeScript package** (`packages/genealogy`): no DB/framework imports, fully unit-testable, reusable by web, API and mobile.
3. **Person ≠ User.** Person belongs to a Family; User link is optional. Leaving a family never deletes Person data.
4. **Partial dates stored as ISO strings** ("1950", "1950-03") + derived `birthYear`. Genealogy rarely has exact dates; validation only rejects *certain* contradictions.
5. **Cycle protection on ParentChild only.** Marriage is a separate undirected relation (so the family graph is a DAG on parent→child edges).
6. **Relationship result is language-neutral** (`kind`, `generations`, `degree`, `removed`, `half`, `path`); the UI maps it to Uzbek/Russian/English labels.
7. **Tree rendering: React Flow + elkjs/dagre layout**, viewport virtualization for large trees (decision to be verified with a 10 000-node benchmark in Phase 7).
8. **Search:** PostgreSQL FTS (generated tsvector + GIN) first; OpenSearch later behind a `SearchService` interface.

## Privacy by design
- Living persons default `PRIVATE`; visibility enum `PRIVATE | SELECTED | FAMILY | PUBLIC`; `SELECTED` backed by `ContentAccess`.
- One authorization function `can(user, action, resource)`; fields the viewer may not see are omitted from responses, not nulled.
- Map/Location stores approximate places only.
- Audit log is append-only and contains no sensitive content.
- GDPR/data-protection specifics: *This is a product/legal decision requiring jurisdiction-specific review.*

## ADR update — Tree rendering (Phase 7)
Decision changed from *React Flow + elkjs/dagre* to a **custom pure layout engine (`packages/genealogy/src/layout.ts`) + SVG renderer**.
Why: spouse units on one row, multiple parents and marriage links are not handled well by generic graph layouts; the engine is pure TypeScript and was benchmarked here (10 / 100 / 1 000 / 10 000 people: 0 / 1 / 19 / 305 ms, zero card overlaps); no new runtime dependency.
Rendering: pan, wheel/pinch zoom, search, collapse/expand branches, fullscreen, keyboard (+ − 0 arrows, Tab to cards), viewport virtualization above 250 cards, level-of-detail when zoomed far out.
Known limits: a person with parents in two different units is drawn under the first (the other link is a longer line); a person with 3+ spouses is shown as a chain; SVG with 10 000 cards is virtualized but not yet benchmarked in a real browser.
