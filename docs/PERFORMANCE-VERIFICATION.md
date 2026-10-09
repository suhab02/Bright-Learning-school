# Production performance and workflow verification — 9 October 2026

## Findings and changes

- Production functions ran in `iad1` (US East), while the Supabase database runs in
  `ap-northeast-1` (Tokyo). Configure functions in `hnd1` to colocate them with the database.
- Auth validation and membership lookup ran sequentially. Run both concurrently, while
  still requiring a validated Auth user before returning any context. Owner bootstrap
  retains the verified-email and database safeguards.
- Share the Supabase server client, section options and school-date reads within each
  React server request. These caches do not persist across users or requests.
- Fetch the shell's school/profile/year/unread reads concurrently. Fetch dashboard
  profile details alongside its other queries.
- Initial Realtime subscription, window focus, visibility changes and successful saves
  caused redundant full-page refreshes. Batch change signals, reconcile on reconnect or
  returning after 30 seconds, and use server-action revalidation after successful saves.
- Attendance now exposes its controlled unsaved state to the live-update guard and
  avoids a second refresh after its server action has revalidated the page.

## Evidence

Signed in to the production app through the secure browser-authentication flow.
Observed all main owner screens rendering without application errors: dashboard,
students, attendance, fees, payments, classes, teachers, staff, guardians, homework,
exams, expenses, reports, notices, settings, help and notifications. Also inspected
the existing student's detail page. Empty lists correspond to the school data, rather
than missing screens. No existing student or financial data was changed.

Baseline full navigation until the main heading rendered in the test browser:

| Screen | Observed time |
| --- | ---: |
| Students | 2,634 ms |
| Attendance | 2,425 ms |
| Fees | 2,403 ms |
| Classes | 2,480 ms |
| Staff | 3,260 ms |
| Homework | 1,701 ms |
| Reports | 1,847 ms |

These include browser automation and network overhead, are single observations rather
than percentiles, and are not measurements of a user's phone. PostgreSQL statement
statistics showed the frequently used context RPC averaging about 7.5 ms and finance
queries about 8.3 ms, supporting network round trips as the immediate target.

ESLint and a production build passed. All six isolated SQL suites passed again.
A hosted, rollback-only workflow smoke test passed again for invitations, assignment,
admission, parent links, homework, stale/atomic marks, publication, suspension and
expense approval; temporary records were rolled back and the real student remained.

## Remaining verification limits

The database tests cover writes and role isolation. The browser audit covers owner
screen rendering and selected read interactions; it does not establish that every
write, parent/teacher browser flow, photo upload or receipt download has been tested.
Vercel runtime-log access returned 403 and its metrics query failed, so no production
p95 or complete error-log conclusion is claimed. Browser console errors seen during
the audit came from the browser extension, not the application bundle.

Supabase performance advisors flag unindexed foreign keys and per-row Auth policy
calls that may matter at larger school sizes. They are not evidence of the current
multi-second delay in this one-student school. Keep existing indexes and permissions;
review query plans against realistic data before broad schema changes.
