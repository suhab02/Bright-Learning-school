-- Complete the school screens with scoped mutations and atomic result publication.
alter table public.marks add column grade text;
alter table public.marks add column grade_point numeric(3,2);
create or replace function public.manage_school_member(p_member uuid, p_role text, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare m school_members;
begin
  select * into m from school_members where id=p_member for update;
  if not found or not is_super_admin(m.school_id) or m.role_key='super_admin' then
    raise exception 'permission_denied' using errcode='42501'; end if;
  if p_role not in ('admin','accountant','teacher','guardian') or p_status not in ('active','suspended')
     or (m.role_key='guardian') <> (p_role='guardian') then raise exception 'invalid_input'; end if;
  update school_members set role_key=p_role,status=p_status where id=p_member;
  if m.role_key<>p_role or p_role='guardian' then delete from member_permission_overrides where member_id=p_member; end if;
  perform write_audit(m.school_id,'member.update','school_members',p_member::text,to_jsonb(m),jsonb_build_object('role',p_role,'status',p_status));
end $$;

create or replace function public.set_member_permission(p_member uuid,p_permission text,p_mode text)
returns void language plpgsql security definer set search_path=public as $$
declare m school_members;
begin
  select * into m from school_members where id=p_member for update;
  if not found or not is_super_admin(m.school_id) or m.role_key in ('super_admin','guardian') then
    raise exception 'permission_denied' using errcode='42501'; end if;
  if p_mode not in ('default','grant','deny') or not exists(select 1 from permissions where key=p_permission) then raise exception 'invalid_input'; end if;
  if p_mode='default' then delete from member_permission_overrides where member_id=p_member and permission_key=p_permission;
  else insert into member_permission_overrides(member_id,permission_key,granted) values(p_member,p_permission,p_mode='grant')
    on conflict(member_id,permission_key) do update set granted=excluded.granted; end if;
  perform write_audit(m.school_id,'permission.update','school_members',p_member::text,null,jsonb_build_object('permission',p_permission,'mode',p_mode));
end $$;

-- Subject assignments constrain teachers; office staff may have school-wide marks permission.
create or replace function public.can_enter_exam_subject(p_exam_subject uuid,p_section uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from exam_subjects es join exams ex on ex.id=es.exam_id
   join sections sec on sec.id=p_section and sec.class_id=es.class_id and sec.school_id=ex.school_id
   where es.id=p_exam_subject and (has_perm(ex.school_id,'marks.enter') or exists(
     select 1 from teacher_assignments ta join staff st on st.id=ta.staff_id
     join school_members m on m.school_id=ex.school_id and m.user_id=auth.uid() and m.status='active'
     where ta.section_id=sec.id and ta.academic_year_id=ex.academic_year_id
       and st.profile_id=auth.uid() and st.status<>'resigned'
       and (ta.subject_id is null or ta.subject_id=es.subject_id))))
$$;

create or replace function public.exam_marks_roster(p_exam_subject uuid)
returns table(student_id uuid,full_name_en text,full_name_bn text,roll_no int,section_name text,
  marks_obtained numeric,is_absent boolean,updated_at timestamptz)
language plpgsql stable security definer set search_path=public as $$
declare sch uuid;
begin
  select ex.school_id into sch from exam_subjects es join exams ex on ex.id=es.exam_id where es.id=p_exam_subject;
  if sch is null or not is_member(sch) or not (has_perm(sch,'marks.enter') or has_perm(sch,'exams.manage') or has_perm(sch,'results.publish') or exists(
    select 1 from sections s join exam_subjects es on es.class_id=s.class_id
    where es.id=p_exam_subject and can_enter_exam_subject(es.id,s.id))) then
    raise exception 'permission_denied' using errcode='42501'; end if;
  return query select st.id,st.full_name_en,st.full_name_bn,en.roll_no,sec.name,m.marks_obtained,
    coalesce(m.is_absent,false),m.updated_at
  from exam_subjects es join exams ex on ex.id=es.exam_id
  join sections sec on sec.class_id=es.class_id and sec.school_id=ex.school_id
  join enrollments en on en.section_id=sec.id and en.academic_year_id=ex.academic_year_id and en.status='active'
  join students st on st.id=en.student_id and st.status='active' and st.school_id=ex.school_id
  left join marks m on m.exam_subject_id=es.id and m.student_id=st.id
  where es.id=p_exam_subject and (can_enter_exam_subject(es.id,sec.id) or has_perm(sch,'exams.manage') or has_perm(sch,'results.publish'))
  order by sec.name,en.roll_no nulls last,st.full_name_en;
end $$;

create or replace function public.save_exam_marks(p_exam_subject uuid,p_entries jsonb)
returns int language plpgsql security definer set search_path=public as $$
declare ex exams; es exam_subjects; e jsonb; en enrollments; old_m marks; n int:=0; score numeric; absent boolean;
begin
  select * into es from exam_subjects where id=p_exam_subject;
  if not found then raise exception 'invalid_input'; end if;
  select * into ex from exams where id=es.exam_id for update;
  if ex.status not in ('draft','marks_entry') then raise exception 'results_locked'; end if;
  if jsonb_typeof(p_entries) is distinct from 'array' or jsonb_array_length(p_entries) not between 1 and 5000 then raise exception 'invalid_input'; end if;
  if (select count(*)<>count(distinct x->>'student_id') from jsonb_array_elements(p_entries) x) then raise exception 'duplicate_student'; end if;
  for e in select * from jsonb_array_elements(p_entries) loop
    select * into en from enrollments where student_id=(e->>'student_id')::uuid and academic_year_id=ex.academic_year_id and status='active';
    if not found or not can_enter_exam_subject(es.id,en.section_id) or not exists(
      select 1 from students st where st.id=en.student_id and st.school_id=ex.school_id and st.status='active') then
      raise exception 'permission_denied' using errcode='42501'; end if;
    absent:=(e->>'is_absent')::boolean; score:=(e->>'marks_obtained')::numeric;
    if absent is null or (not absent and score is null) or (absent and score is not null)
       or score<0 or score>es.full_marks or score::text='NaN' then raise exception 'invalid_marks'; end if;
    select * into old_m from marks where exam_subject_id=es.id and student_id=en.student_id for update;
    if e ? 'expected_updated_at' and old_m.updated_at is distinct from (e->>'expected_updated_at')::timestamptz then raise exception 'marks_conflict' using errcode='40001'; end if;
    insert into marks(school_id,exam_subject_id,student_id,marks_obtained,is_absent,status,entered_by)
      values(ex.school_id,es.id,en.student_id,score,absent,'submitted',auth.uid())
      on conflict(exam_subject_id,student_id) do update set marks_obtained=excluded.marks_obtained,is_absent=excluded.is_absent,status='submitted',entered_by=auth.uid();
    n:=n+1;
  end loop;
  perform write_audit(ex.school_id,'marks.save','exam_subjects',es.id::text,null,jsonb_build_object('count',n));
  return n;
end $$;

create or replace function public.publish_exam(p_exam uuid) returns int
language plpgsql security definer set search_path=public as $$
declare ex exams; n int; scale uuid;
begin
  select * into ex from exams where id=p_exam for update;
  if not found then raise exception 'invalid_input'; end if;
  perform require_perm(ex.school_id,'results.publish');
  if ex.status='published' then return 0; end if;
  if not exists(select 1 from exam_subjects where exam_id=ex.id) or not exists(
    select 1 from exam_subjects es join sections sec on sec.class_id=es.class_id and sec.school_id=ex.school_id
    join enrollments en on en.section_id=sec.id and en.academic_year_id=ex.academic_year_id and en.status='active'
    join students st on st.id=en.student_id and st.status='active' where es.exam_id=ex.id)
    or exists(select 1 from exam_subjects es
    join sections sec on sec.class_id=es.class_id and sec.school_id=ex.school_id
    join enrollments en on en.section_id=sec.id and en.academic_year_id=ex.academic_year_id and en.status='active'
    join students st on st.id=en.student_id and st.status='active'
    left join marks m on m.exam_subject_id=es.id and m.student_id=st.id
    where es.exam_id=ex.id and (m.id is null or m.status not in ('submitted','approved'))) then
      raise exception 'incomplete_marks'; end if;
  scale:=coalesce(ex.grade_scale_id,(select id from grade_scales where school_id=ex.school_id and is_default));
  if scale is not null and exists(select 1 from marks m join exam_subjects es on es.id=m.exam_subject_id where es.exam_id=ex.id
    and not exists(select 1 from grade_bands b where b.scale_id=scale and round(case when m.is_absent then 0 else m.marks_obtained/es.full_marks*100 end,2) between b.min_percent and b.max_percent)) then
    raise exception 'incomplete_grading_scale'; end if;
  perform set_config('app.publish_exam','on',true);
  update marks m set status='approved',
    grade=(select b.grade from grade_bands b where b.scale_id=scale and round(case when m.is_absent then 0 else m.marks_obtained/es.full_marks*100 end,2) between b.min_percent and b.max_percent),
    grade_point=(select b.grade_point from grade_bands b where b.scale_id=scale and round(case when m.is_absent then 0 else m.marks_obtained/es.full_marks*100 end,2) between b.min_percent and b.max_percent)
    from exam_subjects es where m.exam_subject_id=es.id and es.exam_id=ex.id;
  get diagnostics n=row_count;
  update exams set status='published',published_at=now(),published_by=auth.uid() where id=ex.id;
  perform set_config('app.publish_exam','off',true);
  perform write_audit(ex.school_id,'exam.publish','exams',ex.id::text,null,jsonb_build_object('marks',n));
  return n;
end $$;

create or replace function public.guard_exam_lifecycle() returns trigger
language plpgsql security definer set search_path=public as $$
declare ex exams;
begin
 if tg_table_name='exams' then
   if tg_op='DELETE' then
     if old.status='published' then raise exception 'results_locked';end if;
     return old;
   end if;
   if tg_op='UPDATE' and old.status='published' then raise exception 'results_locked'; end if;
   if new.status='published' and coalesce(current_setting('app.publish_exam',true),'')<>'on' then raise exception 'Use publish_exam'; end if;
   if not exists(select 1 from academic_years where id=new.academic_year_id and school_id=new.school_id) then raise exception 'invalid_school_reference'; end if;
 else
   select * into ex from exams where id=coalesce(new.exam_id,old.exam_id) for update;
   if ex.status='published' then raise exception 'results_locked'; end if;
   if tg_op='UPDATE' and (new.exam_id<>old.exam_id or ((new.class_id,new.subject_id,new.full_marks,new.pass_marks) is distinct from (old.class_id,old.subject_id,old.full_marks,old.pass_marks) and exists(select 1 from marks where exam_subject_id=old.id))) then raise exception 'subject_has_marks'; end if;
   if tg_op<>'DELETE' and (not exists(select 1 from classes where id=new.class_id and school_id=ex.school_id)
     or not exists(select 1 from subjects where id=new.subject_id and school_id=ex.school_id)) then raise exception 'invalid_school_reference'; end if;
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
create trigger exams_lifecycle before insert or update or delete on public.exams for each row execute function public.guard_exam_lifecycle();
create trigger exam_subjects_lifecycle before insert or update or delete on public.exam_subjects for each row execute function public.guard_exam_lifecycle();

create or replace function public.record_homework_completion(p_homework uuid,p_student uuid,p_status text,p_note text default null)
returns void language plpgsql security definer set search_path=public as $$
declare h homework;
begin
 select * into h from homework where id=p_homework for update;
 if not found or not (has_perm(h.school_id,'homework.manage') or teaches_section(h.section_id)) then raise exception 'permission_denied' using errcode='42501'; end if;
 if p_status not in ('pending','submitted','completed','late') or length(coalesce(p_note,''))>1000
   or not exists(select 1 from enrollments e join academic_years y on y.id=e.academic_year_id and y.is_current
     where e.student_id=p_student and e.section_id=h.section_id and e.status='active') then raise exception 'invalid_input'; end if;
 insert into homework_status(homework_id,student_id,school_id,status,teacher_note,updated_at)
 values(h.id,p_student,h.school_id,p_status,p_note,now()) on conflict(homework_id,student_id)
 do update set status=excluded.status,teacher_note=excluded.teacher_note,updated_at=now();
end $$;

create or replace function public.school_operational_report(p_school uuid,p_from date,p_to date)
returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 perform require_perm(p_school,'reports.view');
 if p_from is null or p_to is null or p_to<p_from then raise exception 'invalid_input'; end if;
 return jsonb_build_object('active_students',(select count(*) from students where school_id=p_school and status='active'),
 'attendance',(select coalesce(jsonb_object_agg(status,n),'{}') from(select status,count(*) n from student_attendance where school_id=p_school and date between p_from and p_to group by status) a),
 'by_class',(select coalesce(jsonb_agg(jsonb_build_object('name_en',c.name_en,'name_bn',c.name_bn,'students',
   (select count(*) from enrollments e join sections s on s.id=e.section_id join academic_years y on y.id=e.academic_year_id and y.is_current
    join students st on st.id=e.student_id and st.status='active' where s.class_id=c.id and e.status='active')) order by c.sort_order),'[]') from classes c where c.school_id=p_school and c.is_active));
end $$;

-- Audit the ordinary UI mutations as well as privileged RPCs.
create or replace function public.audit_school_workflow() returns trigger
language plpgsql security definer set search_path=public as $$
declare before_j jsonb; after_j jsonb; sch uuid; rid text;
begin
 if tg_op<>'INSERT' then before_j:=to_jsonb(old); end if;
 if tg_op<>'DELETE' then after_j:=to_jsonb(new); end if;
 sch:=coalesce((after_j->>'school_id')::uuid,(before_j->>'school_id')::uuid);
 rid:=coalesce(after_j->>'id',before_j->>'id');
 if sch is null and tg_table_name='exam_subjects' then select school_id into sch from exams where id=coalesce((after_j->>'exam_id')::uuid,(before_j->>'exam_id')::uuid); end if;
 if auth.uid() is not null and sch is not null then perform write_audit(sch,lower(tg_table_name||'.'||tg_op),tg_table_name,rid,before_j,after_j); end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
do $$declare t text; begin
 foreach t in array array['classes','sections','subjects','staff','teacher_assignments','homework','notices','exams','exam_subjects','expenses'] loop
 execute format('create trigger workflow_audit after insert or update or delete on public.%I for each row execute function public.audit_school_workflow()',t);
 end loop;
end $$;

-- Permission to enter marks also permits reading those saved marks.
drop policy marks_read on public.marks;
create policy marks_read on public.marks for select to authenticated using(
 has_perm(school_id,'exams.manage') or has_perm(school_id,'results.publish') or has_perm(school_id,'marks.enter')
 or teaches_student(student_id) or (is_guardian_of(student_id) and status='approved' and exists(
 select 1 from exam_subjects es join exams ex on ex.id=es.exam_id where es.id=exam_subject_id and ex.status='published')));
-- All result writes go through the locked, validated RPC; no direct API bypass.
drop policy marks_write on public.marks;
drop policy marks_update on public.marks;
-- New functions are explicit APIs, never callable by anonymous visitors.
revoke all on function public.manage_school_member(uuid,text,text),public.set_member_permission(uuid,text,text),
 public.can_enter_exam_subject(uuid,uuid),public.exam_marks_roster(uuid),public.save_exam_marks(uuid,jsonb),
 public.record_homework_completion(uuid,uuid,text,text),public.school_operational_report(uuid,date,date),
 public.guard_exam_lifecycle(),public.audit_school_workflow() from public,anon,authenticated;
grant execute on function public.manage_school_member(uuid,text,text),public.set_member_permission(uuid,text,text),
 public.can_enter_exam_subject(uuid,uuid),public.exam_marks_roster(uuid),public.save_exam_marks(uuid,jsonb),
 public.record_homework_completion(uuid,uuid,text,text),public.school_operational_report(uuid,date,date) to authenticated;
-- Internal audit writer isn't a public API.
revoke execute on function public.write_audit(uuid,text,text,text,jsonb,jsonb,text) from authenticated;

create or replace function public.homework_completion_roster(p_homework uuid)
returns table(student_id uuid,full_name_en text,full_name_bn text,roll_no int,status text,teacher_note text)
language plpgsql stable security definer set search_path=public as $$
declare h homework;
begin
 select * into h from homework where id=p_homework;
 if not found or not(has_perm(h.school_id,'homework.manage') or teaches_section(h.section_id)) then raise exception 'permission_denied' using errcode='42501'; end if;
 return query select st.id,st.full_name_en,st.full_name_bn,e.roll_no,coalesce(hs.status,'pending'),hs.teacher_note
 from enrollments e join academic_years y on y.id=e.academic_year_id and y.is_current
 join students st on st.id=e.student_id and st.status='active'
 left join homework_status hs on hs.homework_id=h.id and hs.student_id=st.id
 where e.section_id=h.section_id and e.status='active' order by e.roll_no nulls last,st.full_name_en;
end $$;
revoke all on function public.homework_completion_roster(uuid) from public,anon;
grant execute on function public.homework_completion_roster(uuid) to authenticated;

-- Enforce same-school foreign keys even for clients calling the Data API directly.
create or replace function public.guard_workflow_scope() returns trigger
language plpgsql security definer set search_path=public as $$
declare j jsonb:=to_jsonb(new); sch uuid:=(j->>'school_id')::uuid; ref text; tab text; obj uuid;
begin
 if tg_op='UPDATE' and (j->>'school_id') is distinct from (to_jsonb(old)->>'school_id') then raise exception 'invalid_school_reference'; end if;
 foreach ref in array array['class_id','section_id','subject_id','staff_id','academic_year_id','period_id','category_id','guardian_id'] loop
   obj:=(j->>ref)::uuid;
   if obj is null then continue; end if;
   tab:=case ref when 'class_id' then 'classes' when 'section_id' then 'sections' when 'subject_id' then 'subjects'
     when 'staff_id' then 'staff' when 'academic_year_id' then 'academic_years' when 'period_id' then 'periods'
     when 'category_id' then 'expense_categories' when 'guardian_id' then 'guardians' end;
   if not exists(select 1 from pg_class where oid=to_regclass('public.'||tab)) then raise exception 'invalid_input'; end if;
   execute format('select id from public.%I where id=$1 and school_id=$2',tab) into obj using obj,sch;
   if obj is null then raise exception 'invalid_school_reference'; end if;
 end loop;
 return new;
end $$;
do $$declare tab text;begin
 foreach tab in array array['sections','teacher_assignments','homework','timetable_entries','expenses','invitations'] loop
 execute format('create trigger workflow_scope before insert or update on public.%I for each row execute function public.guard_workflow_scope()',tab);
 end loop;
end $$;
revoke all on function public.guard_workflow_scope() from public,anon,authenticated;

-- Guardians never receive staff capabilities through direct permission-table requests.
drop policy overrides_write on public.member_permission_overrides;
create policy overrides_write on public.member_permission_overrides for all to authenticated
 using(exists(select 1 from school_members m where m.id=member_id and is_super_admin(m.school_id) and m.role_key not in('super_admin','guardian')))
 with check(exists(select 1 from school_members m where m.id=member_id and is_super_admin(m.school_id) and m.role_key not in('super_admin','guardian')));
-- Membership changes use the audited, validated owner RPC.
drop policy members_write on public.school_members;
-- Homework statuses are checked against the homework section in the RPC.
drop policy hws_write on public.homework_status;

-- Publish only newly needed tables; every delivery still checks row security.
do $$declare t text;begin
 foreach t in array array['homework_status','exams','marks'] loop
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
 execute format('alter publication supabase_realtime add table public.%I',t);end if;
 end loop;
end $$;

-- Bands cannot overlap. Published grades are stored on marks as immutable snapshots.
create or replace function public.guard_grade_band() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 perform 1 from grade_scales where id=new.scale_id for update;
 if exists(select 1 from grade_bands where scale_id=new.scale_id and id<>new.id
   and new.min_percent<=max_percent and new.max_percent>=min_percent) then raise exception 'overlapping_grade_band'; end if;
 return new;
end $$;
create trigger grade_band_check before insert or update on public.grade_bands for each row execute function public.guard_grade_band();
revoke all on function public.guard_grade_band() from public,anon,authenticated;

-- Draft homework progress must stay private until the work itself is published.
drop policy hws_read on public.homework_status;
create policy hws_read on public.homework_status for select to authenticated using(
 has_perm(school_id,'homework.manage') or teaches_student(student_id) or
 (is_guardian_of(student_id) and exists(select 1 from homework h where h.id=homework_id and h.status='published')));

-- A teacher may edit only their own section-targeted notices, including through the API.
drop policy notices_insert on public.notices;
drop policy notices_update on public.notices;
drop policy notices_delete on public.notices;
create policy notices_insert on public.notices for insert to authenticated with check(
 is_member(school_id) and created_by=auth.uid() and (has_perm(school_id,'notices.manage') or
 (audience='sections' and cardinality(target_ids)>0 and not exists(select 1 from unnest(target_ids) s where not teaches_section(s)))));
create policy notices_update on public.notices for update to authenticated
 using(is_member(school_id) and (has_perm(school_id,'notices.manage') or (created_by=auth.uid() and audience='sections'
 and cardinality(target_ids)>0 and not exists(select 1 from unnest(target_ids) s where not teaches_section(s)))))
 with check(is_member(school_id) and (has_perm(school_id,'notices.manage') or (created_by=auth.uid() and audience='sections'
 and cardinality(target_ids)>0 and not exists(select 1 from unnest(target_ids) s where not teaches_section(s)))));

create or replace function public.guard_member_identity() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if new.user_id<>old.user_id or new.school_id<>old.school_id then raise exception 'invalid_school_reference';end if;
 if new.role_key='guardian' then delete from member_permission_overrides where member_id=new.id;end if;
 return new;
end $$;
create trigger member_identity before update on public.school_members for each row execute function public.guard_member_identity();
revoke all on function public.guard_member_identity() from public,anon,authenticated;

-- Harden existing helpers identified by the security advisor; triggers are internal APIs.
do $$declare f record;begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('block_mutation','touch_updated_at','check_marks','guard_payments',
  'guard_invoice_items','guard_expenses','storage_school','normalize_bd_phone','_student_fields_check') loop
  execute format('alter function %s set search_path=public',f.signature);
 end loop;
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('set_staff_code','set_student_code','protect_super_admin','handle_new_user','audit_school_update','fanout_notice') loop
  execute format('revoke execute on function %s from public,anon,authenticated',f.signature);
 end loop;
end $$;
revoke execute on function public.my_context() from public,anon;
