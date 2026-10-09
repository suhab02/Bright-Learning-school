-- 20_students.sql — admission, sibling linking, permissions, privacy, edits, status changes
-- Runs after 10_security_and_finance.sql (reuses its users and test helpers).

do $t$ declare sid uuid; again uuid; r record; begin
  perform test.login('admin');
  -- automatic roll: Class One already has roll 1 → next is 2
  sid := admit_student(jsonb_build_object(
    'full_name_en', 'Nusrat Jahan', 'full_name_bn', 'নুসরাত জাহান', 'section_id', test.id('secOne'),
    'gender', 'female', 'guardian_name', 'Karim Rahman', 'guardian_phone', '+880 1711-000000',
    'guardian_relationship', 'father', 'roll_no', '', 'admission_no', '', 'date_of_birth', '', 'blood_group', '', 'address', '',
    'emergency_contact_name', '', 'emergency_contact_phone', '', 'guardian_email', '',
    'request_id', '11111111-1111-1111-1111-111111111111'));
  insert into test.ids values ('s3', sid);
  select * into r from student_directory where id = sid;
  assert r.roll_no = 2, 'auto roll should be 2, got ' || r.roll_no;
  assert r.class_name_en = 'Class One';
  -- sibling: same phone (different format) links the existing guardian instead of a duplicate
  assert r.guardian_id = test.id('g1'), 'sibling guardian not linked';
  assert (select count(*) from guardians where phone = '01711000000') = 1, 'duplicate guardian created';

  -- double tap / retry with the same request id → same student, nothing new
  again := admit_student(jsonb_build_object('full_name_en', 'Nusrat Jahan', 'section_id', test.id('secOne'),
    'request_id', '11111111-1111-1111-1111-111111111111'));
  assert again = sid, 'retry created a second student';
  assert (select count(*) from students where full_name_en = 'Nusrat Jahan') = 1;

  perform test.expect_error(format($f$select admit_student(jsonb_build_object('full_name_en','X','section_id',%L,'roll_no',2))$f$,
    test.id('secOne')), 'duplicate_roll');
  perform test.expect_error($f$select admit_student(jsonb_build_object('section_id', test.id('secOne')))$f$, 'name_required');
  perform test.expect_error($f$select admit_student(jsonb_build_object('full_name_en','X'))$f$, 'class_required');
  assert not exists (select 1 from audit_logs), 'admin must not read the audit log';
  perform test.login('owner');
  assert exists (select 1 from audit_logs where action = 'student.admit' and record_id = sid::text), 'admission not audited';
end $t$;

-- who may admit
do $t$ begin
  perform test.login('teacher1');
  perform test.expect_error($f$select admit_student(jsonb_build_object('full_name_en','X','section_id',test.id('secOne')))$f$, 'Permission denied');
  perform test.login('cashier');
  perform test.expect_error($f$select admit_student(jsonb_build_object('full_name_en','X','section_id',test.id('secOne')))$f$, 'Permission denied');
  perform test.login('guardianA');
  perform test.expect_error($f$select admit_student(jsonb_build_object('full_name_en','X','section_id',test.id('secOne')))$f$, 'Permission denied');
end $t$;

-- privacy through the directory view
do $t$ begin
  perform test.login('guardianA');   -- father of s1 and now s3
  assert (select count(*) from student_directory) = 2, 'guardian A should see exactly 2 children';
  perform test.login('guardianB');
  assert (select count(*) from student_directory) = 1, 'guardian B should see only their child';
  assert not exists (select 1 from student_directory where id = test.id('s3'));
  perform test.login('teacher1');    -- teaches Class One only
  assert (select count(*) from student_directory) = 2, 'teacher1 should see the 2 Class One students';
  assert (select count(*) from student_directory where class_name_en = 'KG') = 0;
  perform test.login('outsider');
  assert (select count(*) from student_directory) = 0;
end $t$;

-- editing: move class, roll follows; teacher loses access; audited with before/after
do $t$ begin
  perform test.login('teacher1');
  perform test.expect_error(format($f$select update_student(%L, '{"full_name_en":"Hacked"}')$f$, test.id('s3')), 'Permission denied');
  perform test.login('admin');
  perform update_student(test.id('s3'), jsonb_build_object('full_name_en', 'Nusrat Jahan Rahman',
    'full_name_bn', 'নুসরাত জাহান', 'section_id', test.id('secKG')));
  assert (select class_name_en from student_directory where id = test.id('s3')) = 'KG';
  assert (select roll_no from student_directory where id = test.id('s3')) = 2, 'KG already has roll 1 → expected 2';
  perform test.login('owner');
  assert exists (select 1 from audit_logs where action = 'student.update' and record_id = test.id('s3')::text
                 and before_data->>'full_name_en' = 'Nusrat Jahan' and after_data->>'full_name_en' = 'Nusrat Jahan Rahman');
  perform test.login('teacher1');
  assert not exists (select 1 from student_directory where id = test.id('s3')), 'teacher still sees moved student';
end $t$;

-- status: needs a reason and students.archive; reactivation re-checks the roll
do $t$ begin
  perform test.login('admin');
  perform test.expect_error(format($f$select set_student_status(%L, 'withdrawn', '')$f$, test.id('s3')), 'reason_required');
  perform set_student_status(test.id('s3'), 'withdrawn', 'Family moved to Sylhet town');
  assert (select status from students where id = test.id('s3')) = 'withdrawn';
  -- roll 2 in KG is now free; give it to someone else, then bring s3 back
  perform admit_student(jsonb_build_object('full_name_en','Tanvir','section_id',test.id('secKG'),'roll_no','2',
    'gender','','blood_group','','date_of_birth','','admission_date','','admission_no','','address','',
    'guardian_name','','guardian_phone','','guardian_email','','emergency_contact_name','','emergency_contact_phone',''));
  perform set_student_status(test.id('s3'), 'active', null);
  assert (select roll_no from student_directory where id = test.id('s3')) = 3, 'returning student should get next free roll';
  perform test.login('owner');
  assert exists (select 1 from audit_logs where action = 'student.status' and reason = 'Family moved to Sylhet town');
  assert (select count(*) from students where id = test.id('s3')) = 1, 'student was deleted';
end $t$;

-- nobody can delete a student record (no delete policy): it is only ever archived
do $t$ begin
  perform test.login('admin');
  delete from students where id = test.id('s3');
  assert (select count(*) from students where id = test.id('s3')) = 1, 'student row deleted';
end $t$;

select 'student tests: OK' as result;
