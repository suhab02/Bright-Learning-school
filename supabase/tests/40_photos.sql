-- 40_photos.sql — student photo storage rules (storage.objects is stubbed locally, policies are real)
grant usage on schema storage to authenticated;
grant select, insert, delete on storage.objects to authenticated;

do $t$ declare p text := test.id('school')::text || '/aaaaaaaa-1111-2222-3333-444444444444.jpg'; old text; begin
  -- teachers can't upload; admins (students.create/edit) can
  perform test.login('teacher1');
  perform test.expect_error(format($f$insert into storage.objects(bucket_id, name) values ('student-photos', %L)$f$, p), 'row-level security');
  perform test.login('admin');
  insert into storage.objects(bucket_id, name, owner) values ('student-photos', p, auth.uid());

  -- path must belong to this school and look like an uploaded photo
  perform test.expect_error(format($f$select set_student_photo(%L, 'other-school/x.jpg')$f$, test.id('s1')), 'invalid_photo_path');
  old := set_student_photo(test.id('s1'), p);
  assert old is null;
  assert (select photo_path from student_directory where id = test.id('s1')) = p;

  -- guardian of s1 and s1's teacher can see it; other guardian / outsider can't
  perform test.login('guardianA');
  assert (select count(*) from storage.objects where name = p) = 1, 'guardian A cannot see own child photo';
  perform test.login('teacher1');
  assert (select count(*) from storage.objects where name = p) = 1, 'teacher cannot see student photo';
  perform test.login('guardianB');
  assert (select count(*) from storage.objects where name = p) = 0, 'guardian B sees another child photo';
  perform test.login('outsider');
  assert (select count(*) from storage.objects where name = p) = 0, 'outsider sees a photo';

  -- guardians and teachers can't change photos
  perform test.login('guardianA');
  perform test.expect_error(format($f$select set_student_photo(%L, null)$f$, test.id('s1')), 'Permission denied');
  delete from storage.objects where name = p;
  perform test.login('admin');
  assert (select count(*) from storage.objects where name = p) = 1, 'guardian deleted a photo';

  -- remove: returns the old path for cleanup, audited
  old := set_student_photo(test.id('s1'), null);
  assert old = p;
  perform test.login('owner');
  assert exists (select 1 from audit_logs where action = 'student.photo' and record_id = test.id('s1')::text);
end $t$;

select 'photo tests: OK' as result;
