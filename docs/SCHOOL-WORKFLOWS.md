# Remaining school workflows

All formerly unfinished app routes now have working Bengali/English phone screens.

## Office setup

1. **Classes**: add or rename classes and sections, add subjects and lesson periods,
   create timetable lessons and school-calendar events. A teacher cannot be double-booked
   in the same period. The current academic year is used for assignments and lessons.
2. **Teachers**: add staff details, edit names/contact details, set active/leave/resigned
   status and assign sections or subjects. Save a teacher, then use **Add photo** on their
   card to upload, replace or remove their picture. Photos are compressed on the device
   and stored privately; only school accounts with `teachers.manage` can view or edit them.
   One class teacher is allowed per section/year.
3. **Staff**: the owner creates staff invitation links, changes non-owner roles,
   suspends/reactivates accounts and grants, denies or restores individual permissions.
   Changing a role clears existing permission overrides. Guardians cannot get staff permissions.
4. **Guardians**: create an invitation for an existing student's guardian. Copy and share
   the generated link with that email owner; no message is automatically sent. Invitees must
   sign in or sign up with the invited email. Links expire after seven days and can be revoked.

## Daily teaching

- **Homework**: create a draft or publish a section's homework, set instructions and a due
  date, archive/unpublish it, and open the item to record student completion and teacher notes.
  Parents only see published work and the completion record for their own child.
- **Notices**: publish to everyone, staff, parents or one section. Teachers can publish only
  to assigned sections. Notices create in-app notifications with working detail links.
  Managers can withdraw notices; records remain on file.
- **Exams**: create an exam, choose a grading scale if needed, add subjects by class with
  full/pass marks, then enter each student's score or absence. Saving is atomic and rejects
  stale versions, out-of-range scores and students outside the authorized class/subject.
  Publication requires all active students in the scheduled classes to have submitted marks.
  Only result publishers can publish. Published exams and subjects are locked; parent-visible
  grades and grade points are stored as snapshots. Custom grading bands cannot overlap.

## Parent portal

Parents see linked children, attendance, published homework, balances, charges, payments,
receipts, published results, notices and calendar events. They can edit their phone/address.
Average grade point is the mean of the configured subject grade points, not a claim that
Bangladesh's optional-subject or board-specific GPA rules have been implemented.

## Finance and reporting

- **Expenses**: record a pending expense with category, exact taka/poisha amount, date,
  payment method and vendor. Authorized reviewers approve or reject it; rejection requires
  a reason. Decided expenses cannot be edited or deleted.
- **Reports**: date-range collections, refunds, approved/pending expenses, surplus, billing,
  adjustments and payment methods; current outstanding/overdue balances; students by class
  and recorded attendance counts. The selected range does not restrict the *current* dues.
  Print is available to viewers; CSV download requires `reports.export`.

## Updates and limits

Authenticated Realtime signals refresh student, attendance, fee, notice, notification,
expense, homework and result screens. Refreshes pause while forms contain unsaved edits.
Returning to the app refreshes idle screens after 30 seconds. Change signals are batched
to at most one refresh every five seconds; initial subscription and successful server
actions do not force an extra reload. This needs a working Realtime connection;
no offline writes or background synchronization are promised. Deletes are intentionally not
subscribed to; reopen a screen after removing a timetable lesson or assignment.

Lists show at most 500 records, with 5,000 related records. Operational and financial report
aggregates run in SQL over the full authorized school data. Attendance and homework use
current active enrollments. Year rollover/promotion automation, payroll, staff attendance,
file attachments for homework/notices, parent file submissions, external SMS/email sending,
and a Play Store APK are not included in this release.

## Validation

- ESLint and the Next.js production build.
- Six SQL suites in an isolated PGlite PostgreSQL environment, including legacy finance,
  student, photo and attendance checks and new workflow authorization/atomicity checks.
- SQL coverage: owner access controls; suspended members; guardian restrictions;
  cross-school references; teacher-class scope; atomic and stale mark saves;
  unpublished and published result visibility; locked exams; draft homework privacy;
  homework completion scope; notice audiences; anonymous RPC denial.
- The authenticated Playwright suite requires the separate local Supabase Auth/PostgREST
  stack. It has not been run in this workspace. No production sample students, staff or
  financial entries are added to demonstrate the screens.

The hosted database migration and a rollback-only smoke test additionally verified the
staff invitation → teacher assignment → admission → parent link → homework progress →
mark entry → publication flow, plus account suspension and expense approval. All temporary
users, pupils, guardians, teachers and expenses were rolled back. The post-change security
advisor reported no mutable function search paths or anonymous privileged-function exposure.
It still flags the intentional internal counter table and authenticated privileged APIs.
Existing [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
remains disabled in the project's Auth settings; that setting was not changed by this release.
