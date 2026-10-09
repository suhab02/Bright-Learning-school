# Bright Learning School — school management app

A Bengali/English **phone app** (installable PWA) for Bright Learning School, Mulagul,
Kanaighat, Sylhet: one shared, secure database for the owner, office staff, accountants,
teachers and guardians.

- **Setting it up online:** [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) (written for non-developers)
- **How it's built and secured:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## What works today

| Area | Status |
|---|---|
| Database, row security, audit log and finance rules | Built |
| Sign-in, invitations and secure first-owner setup | Built |
| Phone layout, Bengali/English switch, school crest and installable PWA | Built |
| Dashboard, editable school settings and notifications | Built |
| Students: admission, search, editing, status and private photos | Built |
| Fees: rates, billing, collection, receipts, discounts and reversals | Built |
| Attendance: staff register and guardian monthly history | Added in `feature/attendance`; migration and deployment required |
| Remaining parent portal, teachers, classes, homework, exams, reports, expenses, notices and staff management screens | Pending |

Attendance setup and limitations: [docs/ATTENDANCE.md](docs/ATTENDANCE.md).

## Tests

```bash
PGHOST=/tmp PGPORT=54329 supabase/tests/run.sh   # 13 groups of security & money tests (PostgreSQL 16)
supabase/local-stack/start.sh                      # local Supabase Auth + PostgREST (dev only)
npm run build && npm start &  npx playwright test  # 8 end-to-end browser tests (desktop + phone)
```

The existing app is deployed separately. This branch has not been deployed.
Run the browser suite against the local test stack before releasing it.

## Known limitations

- Logo upload uses Supabase Storage; it was not exercised locally (no Storage server in the
  test stack) and should be checked once on the real project.
- Realtime updates are wired in the database but not yet in the screens.
- Free hosting tiers have limits — read the box at the top of the deployment guide.
