# Bright Learning School — school management app

A Bengali/English **phone app** (installable PWA) for Bright Learning School, Mulagul,
Kanaighat, Sylhet: one shared, secure database for the owner, office staff, accountants,
teachers and guardians.

- **Setting it up online:** [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) (written for non-developers)
- **How it's built and secured:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## What works today

| Area | Status |
|---|---|
| Database: all tables, constraints, Row Level Security, audit log | ✅ built and tested |
| Money rules: atomic + idempotent payments, receipts, reversals, refunds, expenses with approval, reports | ✅ in the database, tested (screens not built yet) |
| Sign-in: Google + email/password, verification, password reset, invitations, secure first-owner setup | ✅ built and tested |
| Phone-app shell, বাংলা / English switch, light/dark theme, school crest | ✅ |
| Dashboard with real figures and setup checklist | ✅ |
| Settings: every school detail, logo, colour, receipt prefix, working days, fee options | ✅ |
| In-app notifications page | ✅ |
| PWA install (manifest, icons, safe service worker) | ✅ |
| Students, guardians, teachers, attendance, homework, exams, fee collection, reports, staff permissions, guardian portal screens | ⏳ next phases — these sections say "not built yet" in the app |

## Tests

```bash
PGHOST=/tmp PGPORT=54329 supabase/tests/run.sh   # 13 groups of security & money tests (PostgreSQL 16)
supabase/local-stack/start.sh                      # local Supabase Auth + PostgREST (dev only)
npm run build && npm start &  npx playwright test  # 8 end-to-end browser tests (desktop + phone)
```

Last run: all database tests and all 8 end-to-end tests passing. Not yet deployed to a real
Supabase/Vercel project — that needs your accounts (see the deployment guide).

## Known limitations

- Logo upload uses Supabase Storage; it was not exercised locally (no Storage server in the
  test stack) and should be checked once on the real project.
- Realtime updates are wired in the database but not yet in the screens.
- Free hosting tiers have limits — read the box at the top of the deployment guide.
