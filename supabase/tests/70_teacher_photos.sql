-- Private teacher uploads, linking/replacement/removal and authorization.
reset role;
do $t$ declare p text := test.id('school')::text||'/aaaaaaaa-1111-2222-3333-444444444445.jpg';
q text := test.id('school')::text||'/aaaaaaaa-1111-2222-3333-444444444446.jpg'; old text;
begin
  assert (select not public from storage.buckets where id='teacher-photos');
  perform test.login('owner');
  insert into storage.objects(bucket_id,name,owner) values('teacher-photos',p,auth.uid()),('teacher-photos',q,auth.uid());
  perform test.expect_error(format($f$select set_staff_photo(%L,'other-school/a.jpg')$f$,test.id('st1')),'invalid_photo_path');
  perform test.expect_error(format($f$select set_staff_photo(%L,%L)$f$,test.id('st1'),test.id('school')::text||'/aaaaaaaa-1111-2222-3333-444444444447.jpg'),'photo_not_uploaded');
  old:=set_staff_photo(test.id('st1'),p); assert old is null;
  assert (select photo_path from staff where id=test.id('st1'))=p;
  old:=set_staff_photo(test.id('st1'),q); assert old=p;
  perform test.login('teacher1');
  assert not exists(select 1 from storage.objects where bucket_id='teacher-photos');
  perform test.expect_error(format('select set_staff_photo(%L,null)',test.id('st1')),'Permission denied');
  perform test.expect_error(format($f$insert into storage.objects(bucket_id,name) values('teacher-photos',%L)$f$,p),'row-level security');
  perform test.login('guardianA');
  assert not exists(select 1 from storage.objects where bucket_id='teacher-photos');
  perform test.login('outsider');
  assert not exists(select 1 from storage.objects where bucket_id='teacher-photos');
  perform test.login('owner');
  old:=set_staff_photo(test.id('st1'),null); assert old=q;
  assert (select photo_path is null from staff where id=test.id('st1'));
  assert not has_function_privilege('anon','public.set_staff_photo(uuid,text)','execute');
end $t$;
select 'teacher photo tests: OK' as result;
