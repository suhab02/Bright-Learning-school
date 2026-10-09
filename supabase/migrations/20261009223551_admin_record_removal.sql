create or replace function public.is_removal_admin(p_school uuid) returns boolean
language sql stable security invoker set search_path=public as $$
select coalesce((public.current_member(p_school)).role_key in ('admin','super_admin'),false)
$$;
revoke execute on function public.is_removal_admin(uuid) from public,anon;
grant execute on function public.is_removal_admin(uuid) to authenticated;

-- Guard direct API deletes as well as the app's buttons.
create or replace function public.guard_admin_delete() returns trigger
language plpgsql security invoker set search_path=public as $$
begin
 if not public.is_removal_admin(old.school_id) then
   raise exception 'Only an admin can delete records' using errcode='42501';
 end if;
 if tg_table_name in ('students','enrollments','student_attendance','payments','payment_allocations','invoice_items') then
   raise exception 'history_protected' using errcode='22023';
 end if;
 if tg_table_name='expenses' and to_jsonb(old)->>'status'='approved' then raise exception 'history_protected'; end if;
 return old;
end $$;
revoke execute on function public.guard_admin_delete() from public,anon,authenticated;

do $$ declare tab text; begin
 foreach tab in array array['classes','sections','subjects','periods','calendar_events','timetable_entries',
 'staff','guardians','teacher_assignments','homework','notices','exams','exam_subjects','expenses',
 'students','enrollments','student_attendance','payments','payment_allocations','invoice_items'] loop
 execute format('create trigger admin_delete_guard before delete on public.%I for each row execute function public.guard_admin_delete()',tab);
 end loop;
end $$;

-- Explicit admin deletion capability; exact allowlist and school scope prevent arbitrary SQL.
-- Definer is intentional: role-based deletion is separate from ordinary edit permissions.
create or replace function public.admin_remove_record(p_school uuid,p_table text,p_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare row_data jsonb; fk record; linked boolean;
begin
 if auth.uid() is null or not public.is_removal_admin(p_school) then
   raise exception 'Only an admin can delete records' using errcode='42501';
 end if;
 if p_table not in ('students','staff','guardians','classes','sections','subjects','periods','calendar_events',
   'timetable_entries','teacher_assignments','homework','notices','exams','exam_subjects','expenses') then
   raise exception 'history_protected' using errcode='22023';
 end if;
 if length(trim(coalesce(p_reason,'')))<3 or length(p_reason)>300 then raise exception 'reason_required'; end if;
 execute format('select to_jsonb(r) from public.%I r where id=$1 and school_id=$2 for update',p_table)
   into row_data using p_id,p_school;
 if row_data is null then raise exception 'not_found'; end if;
 if p_table='students' then
   perform public.set_student_status(p_id,'withdrawn',p_reason); return;
 elsif p_table='staff' then
   update public.staff set status='resigned' where id=p_id and school_id=p_school;
   perform public.write_audit(p_school,'record.archive',p_table,p_id::text,row_data,
     jsonb_build_object('status','resigned'),p_reason); return;
 end if;
 if (p_table='expenses' and row_data->>'status'='approved')
   or (p_table='exams' and row_data->>'status'='published') then
   raise exception 'history_protected' using errcode='22023';
 end if;
 -- Block even CASCADE relationships: deleting a setup record must never erase child history.
 for fk in select ns.nspname as schema_name,c.relname as table_name,a.attname as column_name
 from pg_constraint k join pg_class c on c.oid=k.conrelid
 join pg_namespace ns on ns.oid=c.relnamespace
 join pg_attribute a on a.attrelid=c.oid and a.attnum=k.conkey[1]
 join pg_attribute parent on parent.attrelid=k.confrelid and parent.attnum=k.confkey[1]
 where k.contype='f' and k.confrelid=to_regclass('public.'||p_table)
   and array_length(k.confkey,1)=1 and parent.attname='id' loop
   execute format('select exists(select 1 from %I.%I where %I=$1)',fk.schema_name,fk.table_name,fk.column_name)
     into linked using p_id;
   if linked then raise exception 'record_in_use' using errcode='23503'; end if;
 end loop;
 case p_table
 when 'guardians' then delete from public.guardians where id=p_id and school_id=p_school;
 when 'classes' then delete from public.classes where id=p_id and school_id=p_school;
 when 'sections' then delete from public.sections where id=p_id and school_id=p_school;
 when 'subjects' then delete from public.subjects where id=p_id and school_id=p_school;
 when 'periods' then delete from public.periods where id=p_id and school_id=p_school;
 when 'calendar_events' then delete from public.calendar_events where id=p_id and school_id=p_school;
 when 'timetable_entries' then delete from public.timetable_entries where id=p_id and school_id=p_school;
 when 'teacher_assignments' then delete from public.teacher_assignments where id=p_id and school_id=p_school;
 when 'homework' then delete from public.homework where id=p_id and school_id=p_school;
 when 'notices' then delete from public.notices where id=p_id and school_id=p_school;
 when 'exams' then delete from public.exams where id=p_id and school_id=p_school;
 when 'exam_subjects' then delete from public.exam_subjects where id=p_id and school_id=p_school;
 when 'expenses' then delete from public.expenses where id=p_id and school_id=p_school;
 else raise exception 'history_protected';
 end case;
 perform public.write_audit(p_school,'record.delete',p_table,p_id::text,row_data,null,p_reason);
end $$;
revoke execute on function public.admin_remove_record(uuid,text,uuid,text) from public,anon;
grant execute on function public.admin_remove_record(uuid,text,uuid,text) to authenticated;

-- Extra edit grants never confer archive/withdraw privileges on a non-admin role.
create or replace function public.guard_admin_archive() returns trigger
language plpgsql security invoker set search_path=public as $$
declare before_j jsonb:=to_jsonb(old); after_j jsonb:=to_jsonb(new); removing boolean:=false;
begin
 if tg_table_name='students' then removing:=after_j->>'status' in ('withdrawn','transferred','graduated') and before_j->>'status' is distinct from after_j->>'status';
 elsif tg_table_name='staff' then removing:=after_j->>'status'='resigned' and before_j->>'status' is distinct from after_j->>'status';
 elsif tg_table_name='guardians' then removing:=after_j->>'status'='inactive' and before_j->>'status' is distinct from after_j->>'status';
 elsif tg_table_name='homework' then removing:=after_j->>'status'='archived' and before_j->>'status' is distinct from after_j->>'status';
 elsif tg_table_name='notices' then removing:=before_j->>'is_published'='true' and after_j->>'is_published'='false';
 end if;
 if removing and not public.is_removal_admin(old.school_id) then
   raise exception 'Only an admin can archive records' using errcode='42501';
 end if;
 return new;
end $$;
revoke execute on function public.guard_admin_archive() from public,anon,authenticated;
do $$ declare tab text; begin
 foreach tab in array array['students','staff','guardians','homework','notices'] loop
 execute format('create trigger admin_archive_guard before update on public.%I for each row execute function public.guard_admin_archive()',tab);
 end loop;
end $$;
