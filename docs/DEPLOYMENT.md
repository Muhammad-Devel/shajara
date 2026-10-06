# Deployment (GitHub + Vercel)

1. `npm install` locally and **commit `package-lock.json`** (CI uses `npm ci`).
2. Push to GitHub (`main`, `develop`).
3. Vercel → Add New Project → import repo → **Root Directory: `apps/web`** → Framework: Next.js → Node 22.x → Deploy.
4. Env vars (Project → Settings → Environment Variables): `NEXT_PUBLIC_SITE_URL` (optional now). Later: `DATABASE_URL`, `AUTH_SECRET`, Google, storage keys.
5. Verify: `/`, `/api/v1/health`, `/api/v1/ready`, `/robots.txt`, `/sitemap.xml`.

Never commit `.env*` files (except `.env.example`).
