-- Attendance permissions, validation, atomicity, stale saves and correction audits.
-- Reuses fixtures from the preceding security/student tests.
do $t$ declare version timestamptz; begin
  perform test.login('teacher1');
  assert (select count(*) from attendance_roster(test.id('secOne'), local_today(test.id('school')))) = 1;
  perform test.expect_error($q$select * from attendance_roster(test.id('secKG'), local_today(test.id('school')))$q$, 'Permission denied');
  perform test.expect_error($q$select submit_attendance(test.id('secOne'), local_today(test.id('school')) + 1,
    jsonb_build_array(jsonb_build_object('student_id',test.id('s1'),'status','present')))$q$, 'future date');
  perform test.expect_error($q$select submit_attendance(test.id('secOne'), null,
    jsonb_build_array(jsonb_build_object('student_id',test.id('s1'),'status','present')))$q$, 'future date');
  perform test.expect_error($q$select submit_attendance(test.id('secOne'), local_today(test.id('school')), '[]')$q$, 'invalid_attendance_entries');
  perform test.expect_error($q$select submit_attendance(test.id('secOne'), local_today(test.id('school')), '{}')$q$, 'invalid_attendance_entries');
  perform test.expect_error($q$select submit_attendance(test.id('secOne'), local_today(test.id('school')), null)$q$, 'invalid_attendance_entries');
  perform test.expect_error($q$select submit_attendance(test.id('secOne'), local_today(test.id('school')),
    jsonb_build_array(jsonb_build_object('student_id',test.id('s1'),'status','present'),
      jsonb_build_object('student_id',test.id('s1'),'status','absent')))$q$, 'duplicate_attendance_student');
  perform test.expect_error($q$select submit_attendance(test.id('secOne'), local_today(test.id('school')),
    jsonb_build_array(jsonb_build_object('student_id',test.id('s1'),'status','unknown')))$q$, 'invalid_attendance_entries');

  select marked_at into version from attendance_roster(test.id('secOne'), local_today(test.id('school'))) where student_id = test.id('s1');
  perform submit_attendance(test.id('secOne'), local_today(test.id('school')),
    jsonb_build_array(jsonb_build_object('student_id',test.id('s1'),'status','present','note','On time','expected_marked_at',version)));
  assert (select status from student_attendance where student_id = test.id('s1') and date = local_today(test.id('school'))) = 'present';
  perform test.expect_error(format($q$select submit_attendance(test.id('secOne'), local_today(test.id('school')),
    jsonb_build_array(jsonb_build_object('student_id',test.id('s1'),'status','absent','expected_marked_at',%L)))$q$, version), 'attendance_conflict');

  -- A valid first entry must be rolled back when a later entry is unauthorized.
  perform test.expect_error($q$select submit_attendance(test.id('secOne'), local_today(test.id('school')),
    jsonb_build_array(jsonb_build_object('student_id',test.id('s1'),'status','absent'),
      jsonb_build_object('student_id',test.id('s2'),'status','present')))$q$, 'not enrolled');
  assert (select status from student_attendance where student_id = test.id('s1') and date = local_today(test.id('school'))) = 'present', 'partial batch was saved';
end $t$;

do $t$ declare before_version timestamptz; begin
  perform test.login('owner');
  perform test.expect_error($q$select submit_attendance(test.id('secOne'), local_today(test.id('school')) - 1,
    jsonb_build_array(jsonb_build_object('student_id',test.id('s1'),'status','absent')))$q$, 'reason_required');
  perform submit_attendance(test.id('secOne'), local_today(test.id('school')) - 1,
    jsonb_build_array(jsonb_build_object('student_id',test.id('s1'),'status','excused','note','Approved leave','reason','Office register entry')));
  perform submit_attendance(test.id('secOne'), local_today(test.id('school')) - 1,
    jsonb_build_array(jsonb_build_object('student_id',test.id('s1'),'status','excused','note','Medical leave','reason','Correct leave description')));
  assert exists (select 1 from audit_logs where action = 'attendance.correct' and reason = 'Correct leave description'
    and before_data->>'note' = 'Approved leave' and after_data->>'note' = 'Medical leave'), 'note-only correction was not audited';
  select marked_at into before_version from student_attendance where student_id = test.id('s1') and date = local_today(test.id('school'));
  perform submit_attendance(test.id('secOne'), local_today(test.id('school')),
    jsonb_build_array(jsonb_build_object('student_id',test.id('s1'),'status','present','note','On time')));
  assert (select marked_at from student_attendance where student_id = test.id('s1') and date = local_today(test.id('school'))) = before_version, 'retry changed version';
end $t$;

do $t$ begin
  perform test.login('guardianA');
  assert exists (select 1 from student_attendance where student_id = test.id('s1'));
  assert not exists (select 1 from student_attendance where student_id = test.id('s2'));
  perform test.expect_error($q$select * from attendance_roster(test.id('secOne'), local_today(test.id('school')))$q$, 'Permission denied');
  perform test.expect_error($q$select submit_attendance(test.id('secOne'), local_today(test.id('school')),
    jsonb_build_array(jsonb_build_object('student_id',test.id('s1'),'status','present')))$q$, 'Permission denied');
  perform test.login('guardianB');
  assert not exists (select 1 from student_attendance where student_id = test.id('s1'));
  perform test.login('outsider');
  perform test.expect_error($q$select * from attendance_roster(test.id('secOne'), local_today(test.id('school')))$q$, 'Permission denied');
end $t$;

-- Granting attendance-only access must not expose the full student directory.
do $t$ declare member uuid; begin
  perform test.login('owner');
  select id into member from school_members where user_id = test.id('cashier');
  insert into member_permission_overrides(member_id, permission_key, granted) values
    (member, 'attendance.create', true), (member, 'students.view', false);
  perform test.login('cashier');
  assert not exists (select 1 from students), 'attendance access exposed student details';
  assert (select count(*) from attendance_roster(test.id('secOne'), local_today(test.id('school')))) = 1;
  assert exists (select 1 from student_attendance where student_id = test.id('s1'));
end $t$;
select 'attendance tests: OK' as result;
