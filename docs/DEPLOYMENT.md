# Deployment (GitHub + Vercel)

1. `npm install` locally and **commit `package-lock.json`** (CI uses `npm ci`).
2. Push to GitHub (`main`, `develop`).
3. Vercel → Add New Project → import repo → **Root Directory: `apps/web`** → Framework: Next.js → Node 22.x → Deploy.
4. Env vars (Project → Settings → Environment Variables): `NEXT_PUBLIC_SITE_URL` (optional now). Later: `DATABASE_URL`, `AUTH_SECRET`, Google, storage keys.
5. Verify: `/`, `/api/v1/health`, `/api/v1/ready`, `/robots.txt`, `/sitemap.xml`.

Never commit `.env*` files (except `.env.example`).

## Phase 4a — database and auth (required before auth works)
1. Create a managed PostgreSQL (Neon / Supabase / Vercel Postgres) and copy its connection string.
2. Create the first migration locally (once), commit the generated `packages/database/prisma/migrations/`:
   `DATABASE_URL="<url>" npx prisma migrate dev --name init --schema packages/database/prisma/schema.prisma`
3. Apply it to the production DB: `DATABASE_URL="<prod url>" npm run deploy -w @shajara/database`
4. Vercel env vars (Production + Preview): `DATABASE_URL`, `AUTH_SECRET` (>= 32 random chars: `openssl rand -base64 48`), `NEXT_PUBLIC_SITE_URL`.
5. Deploy from the `develop` branch first (Vercel preview), verify, then merge to `main`.
6. Check: register → dashboard → logout → login; `/api/v1/me` returns 401 when logged out.

Known limit: no email provider yet, so verification and password-reset emails are NOT delivered in production (Phase 4b).

## Phase 4b — email (Resend)
1. Create an account at resend.com → API Keys → create a key.
2. Vercel env vars: `RESEND_API_KEY`, optionally `EMAIL_FROM` (default `SHAJARA <onboarding@resend.dev>`). Redeploy.
3. Without a verified domain, Resend only delivers to the email address of your own Resend account. To email any user, verify a domain in Resend and set `EMAIL_FROM` to an address on it.

## Phase 10 — invitations (DATABASE MIGRATION REQUIRED)
`Invitation.personId` was added. **Before merging to `main`:**
1. `DATABASE_URL="<url>" npx prisma migrate dev --name invitation_person --schema packages/database/prisma/schema.prisma` (creates a migration), commit `packages/database/prisma/migrations/`.
2. Apply it to production: `DATABASE_URL="<prod url>" npm run deploy -w @shajara/database`.
3. Then push/merge; otherwise the new code fails on the missing column.
