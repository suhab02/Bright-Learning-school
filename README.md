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
| Attendance: staff register and guardian monthly history | Built and deployed |
| Parent portal, staff invitations/permissions, teachers, classes, timetable, calendar, homework, notices, exams, expenses and reports | Built; see workflow guide |

Attendance setup and limitations: [docs/ATTENDANCE.md](docs/ATTENDANCE.md).
Remaining workflow setup and limits: [docs/SCHOOL-WORKFLOWS.md](docs/SCHOOL-WORKFLOWS.md).

## Tests

```bash
PGHOST=/tmp PGPORT=54329 supabase/tests/run.sh   # SQL security and workflow suites
supabase/local-stack/start.sh                      # local Supabase Auth + PostgREST (dev only)
npm run build && npm start &  npx playwright test  # browser tests (desktop + phone)
```

Deployments follow the linked GitHub branches. See the workflow guide for the validation
performed in this workspace and the browser tests that still require the local test stack.

## Known limitations

- Logo upload uses Supabase Storage; it was not exercised locally (no Storage server in the
  test stack) and should be checked once on the real project.
- Live update signals refresh idle screens; forms with unsaved edits defer automatic refresh.
- Free hosting tiers have limits — read the box at the top of the deployment guide.
