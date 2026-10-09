# Attendance update

This update adds staff attendance registers and `/portal/attendance` for guardians,
using the existing phone layout and Bengali/English preference.

## Apply to the existing app

1. Apply **only** `supabase/migrations/0010_attendance.sql` to the existing Supabase
   database using its SQL editor (or the existing migration workflow). Do not run
   the local test stubs, seed or database test scripts on production.
2. Deploy the code from `feature/attendance` through the existing Vercel project.
   Keep the existing Supabase environment settings.
3. Open Attendance, select a class and date, then Open register. Each student starts
   unmarked until a saved status exists. Choose Present, Absent, Late or Excused,
   optionally add a note, then Save attendance. Mark all present is a shortcut.
4. Open the same register again to verify the save. Check a teacher account and a
   guardian account before the school starts using it.

Apply the migration before deploying: the new screens call `attendance_roster`.
No existing students, payments, fees, photos, school details or icons are replaced.

## Permissions and behavior

- Attendance viewers can read registers; attendance creators can save today's
  records. Teachers can view and mark their currently assigned sections.
- A past-date save also requires `attendance.correct` and a reason of 3–300
  characters. Both status and note changes are audited.
- Future dates, malformed statuses, duplicate students, inactive students and
  students outside the section are rejected in the database.
- Saving a batch is atomic. The UI includes row versions; a stale register is
  rejected instead of overwriting another staff member's changes. Reload before
  retrying after that warning.
- Guardians see only attendance records for their own linked children under RLS.
  Their monthly percentage counts present and late days over all recorded days;
  unrecorded days are not treated as absences.

## Scope and limitations

The staff register uses the **current academic year's active enrollment**, even
when selecting a past date. It does not reconstruct former class rosters or
previous academic years. Saved parent history remains readable for linked
children, including records from earlier months. Live updates from other devices
require reopening or refreshing the screen; saves refresh the current screen.

The rest of the parent portal, staff management, homework, teachers, notices,
exams, expenses and report screens remain separate follow-up work.

## Validation

- Production build and ESLint passed locally. The build used a temporary,
  external workaround for this container's unavailable memory-usage diagnostic;
  no workaround is included in application code.
- All five SQL suites passed in an isolated PGlite PostgreSQL WASM instance,
  including `supabase/tests/50_attendance.sql`. They cover isolation, validation,
  atomic rollback, stale saves and correction auditing. This is not a test of the
  hosted Supabase Auth, Storage or Realtime services.
- `e2e/06-attendance.spec.ts` adds browser acceptance tests for English/Bengali,
  saving/reopening, phone overflow, past-date reasons and invalid dates. These
  require the repository's local Supabase Auth/PostgREST test stack and have not
  been run in this workspace (the native Auth/PostgREST binaries are unavailable).
