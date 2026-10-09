-- Removal is a role boundary even if the owner grants a teacher extra edit permissions.
do $t$ declare cid uuid; sid uuid; p uuid; begin
  perform test.login('owner');
  insert into public.classes(school_id,name_en,name_bn,sort_order) values(test.id('school'),'Removal test','মুছুন পরীক্ষা',99) returning id into cid;
  insert into public.sections(school_id,class_id,name) values(test.id('school'),cid,'Test') returning id into sid;
  perform test.expect_error(format('select admin_remove_record(%L,%L,%L,%L)',test.id('school'),'classes',cid,'Test reason'),'record_in_use');
  assert exists(select 1 from public.classes where id=cid);
  perform test.login('teacher1');
  perform test.expect_error(format('select admin_remove_record(%L,%L,%L,%L)',test.id('school'),'sections',sid,'Test reason'),'Only an admin');
  perform test.login('cashier');
  perform test.expect_error(format('select admin_remove_record(%L,%L,%L,%L)',test.id('school'),'sections',sid,'Test reason'),'Only an admin');
  perform test.login('guardianA');
  perform test.expect_error(format('select admin_remove_record(%L,%L,%L,%L)',test.id('school'),'sections',sid,'Test reason'),'Only an admin');
  perform test.login('outsider');
  perform test.expect_error(format('select admin_remove_record(%L,%L,%L,%L)',test.id('school'),'sections',sid,'Test reason'),'Only an admin');
  perform test.login('admin');
  perform test.expect_error(format('select admin_remove_record(%L,%L,%L,%L)',test.id('other_school'),'classes',test.id('other_class'),'Wrong school'),'Only an admin');
  perform test.expect_error(format('select admin_remove_record(%L,%L,%L,%L)',test.id('school'),'sections',sid,''),'reason_required');
  perform admin_remove_record(test.id('school'),'sections',sid,'Unused test section');
  assert not exists(select 1 from public.sections where id=sid);
  perform admin_remove_record(test.id('school'),'classes',cid,'Unused test class');
  assert not exists(select 1 from public.classes where id=cid);
  perform test.expect_error(format('select admin_remove_record(%L,%L,%L,%L)',test.id('school'),'payments',test.id('s1'),'Never purge money'),'history_protected');
  perform admin_remove_record(test.id('school'),'students',test.id('s3'),'Archive test student');
  assert (select status from public.students where id=test.id('s3'))='withdrawn';
  assert exists(select 1 from public.enrollments where student_id=test.id('s3'));
  perform test.expect_error(format('select admin_remove_record(%L,%L,%L,%L)',test.id('school'),'guardians',test.id('g1'),'Linked parent'),'record_in_use');
  perform test.expect_error(format('select admin_remove_record(%L,%L,%L,%L)',test.id('school'),'exams',test.id('workflow_exam'),'Published exam'),'history_protected');
  perform test.login('owner');
  assert exists(select 1 from public.audit_logs where action='record.delete' and record_id=cid::text and reason='Unused test class');
  assert not has_function_privilege('anon','public.admin_remove_record(uuid,text,uuid,text)','execute');
end $t$;
-- A teacher with academic edit permission still cannot directly delete records.
do $t$ declare cid uuid; begin
  perform test.login('owner');
  insert into public.classes(school_id,name_en,name_bn,sort_order) values(test.id('school'),'Role boundary','ভূমিকা',100) returning id into cid;
  insert into public.member_permission_overrides(member_id,permission_key,granted)
  select id,'academics.manage',true from public.school_members where user_id=test.id('teacher1') and school_id=test.id('school')
  on conflict(member_id,permission_key) do update set granted=true;
  perform test.login('teacher1');
  perform test.expect_error(format('delete from public.classes where id=%L',cid),'Only an admin');
  perform test.expect_error(format('update public.homework set status=''archived'' where id=%L',test.id('workflow_homework')),'Only an admin');
  perform test.login('owner');
  perform admin_remove_record(test.id('school'),'classes',cid,'Clean isolated fixture');
  delete from public.member_permission_overrides where permission_key='academics.manage' and member_id in
    (select id from public.school_members where user_id=test.id('teacher1') and school_id=test.id('school'));
end $t$;
select 'admin removal tests: OK' as result;
