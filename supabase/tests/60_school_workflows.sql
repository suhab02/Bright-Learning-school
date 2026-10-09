-- Complete module permissions and atomic exam workflows.
insert into schools(name_en,name_bn) values('Other school','অন্য স্কুল');
insert into test.ids select 'other_school',id from schools where name_en='Other school';
insert into classes(school_id,name_en,name_bn) values(test.id('other_school'),'Other class','অন্য শ্রেণি');
insert into test.ids select 'other_class',id from classes where school_id=test.id('other_school');

do $t$ declare member uuid;begin
 perform test.login('owner');
 select id into member from school_members where user_id=test.id('teacher2');
 perform set_member_permission(member,'reports.view','grant');
 perform test.login('teacher2');assert has_perm(test.id('school'),'reports.view');
 assert school_operational_report(test.id('school'),local_today(test.id('school')),local_today(test.id('school'))) ? 'by_class';
 perform test.expect_error($q$select school_operational_report(test.id('other_school'),current_date,current_date)$q$,'Permission denied');
 perform test.expect_error(format('select set_member_permission(%L,''fees.reverse'',''grant'')',member),'permission_denied');
 perform test.login('owner');
 perform set_member_permission(member,'reports.view','default');
 perform manage_school_member(member,'teacher','suspended');
 perform test.login('teacher2');assert not is_member(test.id('school'));
 perform test.login('owner');perform manage_school_member(member,'teacher','active');
 perform test.expect_error(format('select manage_school_member(%L,''super_admin'',''active'')',member),'invalid_input');
 select id into member from school_members where user_id=test.id('guardianA');
 perform test.expect_error(format('select set_member_permission(%L,''fees.reverse'',''grant'')',member),'permission_denied');
 perform test.expect_error(format('insert into member_permission_overrides values(%L,''fees.reverse'',true)',member),'row-level security');
 perform test.expect_error($q$insert into sections(school_id,class_id,name) values(test.id('school'),test.id('other_class'),'Z')$q$,'invalid_school_reference');
end $t$;

do $t$ declare ex uuid;es uuid;ver timestamptz;begin
 perform test.login('owner');
 insert into exams(school_id,academic_year_id,name_en,kind,status) values(test.id('school'),test.id('year'),'Workflow exam','class_test','marks_entry') returning id into ex;
 insert into exam_subjects(exam_id,class_id,subject_id,full_marks,pass_marks)
 select ex,s.class_id,sub.id,50,20 from sections s,subjects sub where s.id=test.id('secOne') and sub.name_en='Mathematics' returning id into es;
 insert into test.ids values('workflow_exam',ex),('workflow_es',es);
 perform test.expect_error(format('select publish_exam(%L)',ex),'incomplete_marks');
 perform test.login('teacher2');
 perform test.expect_error(format('select * from exam_marks_roster(%L)',es),'permission_denied');
 perform test.login('teacher1');
 assert exists(select 1 from exam_marks_roster(es) where student_id=test.id('s1'));
 perform test.expect_error(format($q$select save_exam_marks(%L,jsonb_build_array(jsonb_build_object('student_id',test.id('s1'),'marks_obtained',40,'is_absent',false),jsonb_build_object('student_id',test.id('s2'),'marks_obtained',30,'is_absent',false)))$q$,es),'permission_denied');
 assert not exists(select 1 from marks where exam_subject_id=es),'partial marks were saved';
 perform test.expect_error(format($q$select save_exam_marks(%L,jsonb_build_array(jsonb_build_object('student_id',test.id('s1'),'marks_obtained',null,'is_absent',false)))$q$,es),'invalid_marks');
 perform save_exam_marks(es,jsonb_build_array(jsonb_build_object('student_id',test.id('s1'),'marks_obtained',40,'is_absent',false,'expected_updated_at',null)));
 select updated_at into ver from marks where exam_subject_id=es and student_id=test.id('s1');
 perform test.expect_error(format($q$select save_exam_marks(%L,jsonb_build_array(jsonb_build_object('student_id',test.id('s1'),'marks_obtained',30,'is_absent',false,'expected_updated_at',null)))$q$,es),'marks_conflict');
 perform save_exam_marks(es,jsonb_build_array(jsonb_build_object('student_id',test.id('s1'),'marks_obtained',null,'is_absent',true,'expected_updated_at',ver)));
 perform test.login('guardianA');assert not exists(select 1 from marks where exam_subject_id=es);
 perform test.login('owner');
 perform test.expect_error(format('update exams set status=''published'' where id=%L',ex),'Use publish_exam');
 perform publish_exam(ex);
 perform test.expect_error(format($q$select save_exam_marks(%L,jsonb_build_array(jsonb_build_object('student_id',test.id('s1'),'marks_obtained',30,'is_absent',false)))$q$,es),'results_locked');
 perform test.expect_error(format('update exam_subjects set full_marks=60 where id=%L',es),'results_locked');
 perform test.login('guardianA');assert exists(select 1 from marks where exam_subject_id=es and is_absent and status='approved' and grade='F' and grade_point=0),'published grade snapshot missing';
 perform test.login('guardianB');assert not exists(select 1 from marks where exam_subject_id=es);
end $t$;

do $t$ declare h uuid;n uuid;begin
 perform test.login('teacher1');
 insert into homework(school_id,section_id,title,instructions,status,created_by) values(test.id('school'),test.id('secOne'),'Workflow homework','Read chapter 1','draft',auth.uid()) returning id into h;
 insert into test.ids values('workflow_homework',h);
 assert exists(select 1 from homework_completion_roster(h) where student_id=test.id('s1'));
 perform test.expect_error(format('select record_homework_completion(%L,test.id(''s2''),''completed'')',h),'invalid_input');
 perform record_homework_completion(h,test.id('s1'),'completed','Good work');
 perform test.login('guardianA');assert not exists(select 1 from homework where id=h);
 assert not exists(select 1 from homework_status where homework_id=h),'draft teacher note leaked';
 perform test.login('teacher1');update homework set status='published',published_at=now() where id=h;
 perform test.login('guardianA');assert exists(select 1 from homework where id=h);
 assert exists(select 1 from homework_status where homework_id=h and student_id=test.id('s1') and status='completed');
 perform test.expect_error(format('select record_homework_completion(%L,test.id(''s1''),''submitted'')',h),'permission_denied');
 perform test.login('guardianB');assert not exists(select 1 from homework where id=h);
 perform test.login('teacher1');
 insert into notices(school_id,title,body,audience,target_ids,created_by) values(test.id('school'),'Section notice','Bring books','sections',array[test.id('secOne')],auth.uid()) returning id into n;
 perform test.login('guardianA');assert exists(select 1 from notices where id=n);
 perform test.login('guardianB');assert not exists(select 1 from notices where id=n);
 perform test.login('teacher2');perform test.expect_error($q$insert into notices(school_id,title,body,audience,created_by) values(test.id('school'),'Wrong','Bad','all',auth.uid())$q$,'row-level security');
end $t$;

-- Every added endpoint requires a signed-in request.
do $t$ declare f text;begin
 foreach f in array array['manage_school_member(uuid,text,text)','set_member_permission(uuid,text,text)',
  'exam_marks_roster(uuid)','save_exam_marks(uuid,jsonb)','homework_completion_roster(uuid)',
  'record_homework_completion(uuid,uuid,text,text)','school_operational_report(uuid,date,date)'] loop
 assert not has_function_privilege('anon','public.'||f,'execute'),'anonymous can execute '||f;
 end loop;
end $t$;
select 'school workflow tests: OK' as result;
