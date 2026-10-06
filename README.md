# SHAJARA — Avlodlarni bog‘laymiz. Tarixni saqlaymiz.

Global genealogy & family heritage platform. Modular monolith, MVP → Production → Scale.

## Status
| Phase | Holat |
|---|---|
| 0–2 Product, Architecture, Database | Hujjatlar + Prisma schema tayyor |
| 3 Design system | Tokenlar tayyor (`packages/ui`) |
| 6 Genealogy engine | Tayyor va testlangan (`packages/genealogy`, 17 test) |
| 4 Auth → 5 Family & Person → 7 Tree … | Keyingi |

## Local setup
```bash
git clone <repo> && cd shajara
cp .env.example .env.local      # fill values; never commit
npm install
docker compose up -d            # postgres + minio
npm run db:validate && npm run db:generate
npm test
npm run dev                     # http://localhost:3000
```
Node >= 22.18, npm >= 10 (npm workspaces).

## Structure
```
apps/        web (Next.js), mobile (Expo, later)
packages/    genealogy (pure TS graph engine) · database (Prisma) · ui (tokens) · validation (Zod, later)
docs/        architecture/
```
