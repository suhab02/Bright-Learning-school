-- Editing an already enrolled student can create and edit a primary guardian.
do $t$ declare sid uuid; gid uuid; p jsonb;
begin
  perform test.login('owner');
  sid:=public.admit_student(jsonb_build_object('full_name_en','Guardian edit test','section_id',test.id('secOne')));
  p:=jsonb_build_object('full_name_en','Guardian edit test','section_id',test.id('secOne'),
    'guardian_name','Test Parent','guardian_phone','01799000111','guardian_email','parent@example.test','guardian_relationship','mother');
  perform public.update_student_with_guardian(sid,p);
  select guardian_id into gid from public.student_guardians where student_id=sid and is_primary;
  assert gid is not null;
  assert (select full_name from public.guardians where id=gid)='Test Parent';
  assert (select relationship from public.student_guardians where student_id=sid and guardian_id=gid)='mother';
  perform public.update_student_with_guardian(sid,p||jsonb_build_object('guardian_name','Updated Parent','guardian_phone','01799000222','guardian_relationship','father'));
  assert (select guardian_id from public.student_guardians where student_id=sid and is_primary)=gid;
  assert (select phone from public.guardians where id=gid)='01799000222';
  assert (select relationship from public.student_guardians where student_id=sid and guardian_id=gid)='father';
  perform public.update_student_with_guardian(sid,p||jsonb_build_object('guardian_name','','guardian_phone',''));
  assert (select count(*) from public.student_guardians where student_id=sid)=1;
  perform test.login('teacher1');
  perform test.expect_error(format('select public.update_student_with_guardian(%L,%L::jsonb)',sid,p::text),'Permission denied');
  perform test.login('outsider');
  perform test.expect_error(format('select public.update_student_with_guardian(%L,%L::jsonb)',sid,p::text),'not_found');
  assert not has_function_privilege('anon','public.update_student_with_guardian(uuid,jsonb)','execute');
end $t$;
select 'edit guardian tests: OK' as result;
