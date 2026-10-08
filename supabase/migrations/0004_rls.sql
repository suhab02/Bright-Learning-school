-- 0004_rls.sql — Row Level Security on every table + supporting RPCs
-- Rule of thumb: reads via policies; sensitive writes only via SECURITY DEFINER functions.

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- ───────────── reference data ─────────────
create policy read_roles on public.roles for select to authenticated using (true);
create policy read_perms on public.permissions for select to authenticated using (true);
create policy read_role_perms on public.role_permissions for select to authenticated using (true);
-- school_counters: no policies → no client access at all

-- ───────────── schools ─────────────
create policy schools_read on public.schools for select to authenticated using (is_member(id));
create policy schools_update on public.schools for update to authenticated
  using (has_perm(id, 'settings.manage')) with check (has_perm(id, 'settings.manage'));

-- ───────────── profiles ─────────────
create policy profiles_self on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_staff_read on public.profiles for select to authenticated using (
  exists (select 1 from school_members m where m.user_id = profiles.id and is_staff(m.school_id)));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ───────────── membership & permissions (owner only writes) ─────────────
create policy members_read on public.school_members for select to authenticated
  using (user_id = auth.uid() or has_perm(school_id, 'staff.manage'));
create policy members_write on public.school_members for update to authenticated
  using (is_super_admin(school_id)) with check (is_super_admin(school_id));

create policy overrides_read on public.member_permission_overrides for select to authenticated using (
  exists (select 1 from school_members m where m.id = member_id
          and (m.user_id = auth.uid() or has_perm(m.school_id, 'staff.manage'))));
create policy overrides_write on public.member_permission_overrides for all to authenticated
  using (exists (select 1 from school_members m where m.id = member_id and is_super_admin(m.school_id)
                 and m.role_key <> 'super_admin'))
  with check (exists (select 1 from school_members m where m.id = member_id and is_super_admin(m.school_id)
                 and m.role_key <> 'super_admin'));

create policy invitations_read on public.invitations for select to authenticated using (
  is_super_admin(school_id) or (role_key = 'guardian' and has_perm(school_id, 'guardians.manage')));
create policy invitations_revoke on public.invitations for update to authenticated using (
  is_super_admin(school_id) or (role_key = 'guardian' and has_perm(school_id, 'guardians.manage')));

create policy audit_read on public.audit_logs for select to authenticated using (has_perm(school_id, 'audit.view'));

-- ───────────── academic structure: members read, academics.manage writes ─────────────
do $$
declare t text;
begin
  foreach t in array array['academic_years','classes','sections','subjects','periods','calendar_events',
                           'grade_scales','exams'] loop
    execute format('create policy %1$s_read on public.%1$I for select to authenticated using (is_member(school_id))', t);
  end loop;
  foreach t in array array['academic_years','classes','sections','subjects','periods','calendar_events'] loop
    execute format($f$create policy %1$s_write on public.%1$I for all to authenticated
      using (has_perm(school_id, 'academics.manage')) with check (has_perm(school_id, 'academics.manage'))$f$, t);
  end loop;
  foreach t in array array['grade_scales','exams'] loop
    execute format($f$create policy %1$s_write on public.%1$I for all to authenticated
      using (has_perm(school_id, 'exams.manage')) with check (has_perm(school_id, 'exams.manage'))$f$, t);
  end loop;
end $$;

create policy class_subjects_read on public.class_subjects for select to authenticated
  using (exists (select 1 from classes c where c.id = class_id and is_member(c.school_id)));
create policy class_subjects_write on public.class_subjects for all to authenticated
  using (exists (select 1 from classes c where c.id = class_id and has_perm(c.school_id, 'academics.manage')))
  with check (exists (select 1 from classes c where c.id = class_id and has_perm(c.school_id, 'academics.manage')));

create policy grade_bands_read on public.grade_bands for select to authenticated
  using (exists (select 1 from grade_scales g where g.id = scale_id and is_member(g.school_id)));
create policy grade_bands_write on public.grade_bands for all to authenticated
  using (exists (select 1 from grade_scales g where g.id = scale_id and has_perm(g.school_id, 'exams.manage')))
  with check (exists (select 1 from grade_scales g where g.id = scale_id and has_perm(g.school_id, 'exams.manage')));

create policy exam_subjects_read on public.exam_subjects for select to authenticated
  using (exists (select 1 from exams e where e.id = exam_id and is_member(e.school_id)));
create policy exam_subjects_write on public.exam_subjects for all to authenticated
  using (exists (select 1 from exams e where e.id = exam_id and has_perm(e.school_id, 'exams.manage')))
  with check (exists (select 1 from exams e where e.id = exam_id and has_perm(e.school_id, 'exams.manage')));

-- ───────────── staff ─────────────
create policy staff_read on public.staff for select to authenticated using (
  is_staff(school_id)
  or exists (select 1 from teacher_assignments ta where ta.staff_id = staff.id
             and guardian_of_section(ta.section_id)));
create policy staff_write on public.staff for all to authenticated
  using (has_perm(school_id, 'teachers.manage')) with check (has_perm(school_id, 'teachers.manage'));

create policy salaries_owner on public.staff_salaries for all to authenticated
  using (is_super_admin(school_id)) with check (is_super_admin(school_id));

create policy ta_read on public.teacher_assignments for select to authenticated using (
  is_staff(school_id) or guardian_of_section(section_id));
create policy ta_write on public.teacher_assignments for all to authenticated
  using (has_perm(school_id, 'teachers.manage')) with check (has_perm(school_id, 'teachers.manage'));

create policy staff_att_read on public.staff_attendance for select to authenticated using (
  has_perm(school_id, 'teachers.manage') or staff_id = my_staff_id(school_id));
create policy staff_att_write on public.staff_attendance for all to authenticated
  using (has_perm(school_id, 'teachers.manage')) with check (has_perm(school_id, 'teachers.manage'));

-- ───────────── students & guardians ─────────────
create policy students_read on public.students for select to authenticated using (
  has_perm(school_id, 'students.view') or teaches_student(id) or is_guardian_of(id));
create policy students_insert on public.students for insert to authenticated
  with check (has_perm(school_id, 'students.create'));
create policy students_update on public.students for update to authenticated
  using (has_perm(school_id, 'students.edit')) with check (has_perm(school_id, 'students.edit'));
-- no delete policy: students are archived, never deleted

create policy medical_read on public.student_medical_notes for select to authenticated using (
  has_perm(school_id, 'students.edit') or teaches_student(student_id) or is_guardian_of(student_id));
create policy medical_write on public.student_medical_notes for all to authenticated
  using (has_perm(school_id, 'students.edit')) with check (has_perm(school_id, 'students.edit'));

create policy guardians_read on public.guardians for select to authenticated using (
  profile_id = auth.uid()
  or has_perm(school_id, 'guardians.manage') or has_perm(school_id, 'students.view')
  or exists (select 1 from student_guardians sg where sg.guardian_id = guardians.id
             and teaches_student(sg.student_id)));
create policy guardians_write on public.guardians for all to authenticated
  using (has_perm(school_id, 'guardians.manage')) with check (has_perm(school_id, 'guardians.manage'));

create policy sg_read on public.student_guardians for select to authenticated using (
  has_perm(school_id, 'students.view') or has_perm(school_id, 'guardians.manage')
  or teaches_student(student_id) or is_guardian_of(student_id));
create policy sg_write on public.student_guardians for all to authenticated
  using (has_perm(school_id, 'guardians.manage')) with check (has_perm(school_id, 'guardians.manage'));

create policy enrollments_read on public.enrollments for select to authenticated using (
  has_perm(school_id, 'students.view') or teaches_section(section_id) or is_guardian_of(student_id));
create policy enrollments_write on public.enrollments for all to authenticated
  using (has_perm(school_id, 'students.edit')) with check (has_perm(school_id, 'students.edit'));

-- guardians may update only their own phone / address
create or replace function public.update_my_guardian_contact(p_phone text, p_address text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_phone is not null and p_phone !~ '^\+?[0-9 -]{6,20}$' then raise exception 'Invalid phone number'; end if;
  update guardians set phone = coalesce(p_phone, phone), address = coalesce(p_address, address)
   where profile_id = auth.uid();
end $$;

-- ───────────── attendance ─────────────
create policy att_read on public.student_attendance for select to authenticated using (
  has_perm(school_id, 'attendance.view') or teaches_section(section_id) or is_guardian_of(student_id));
-- writes only through submit_attendance()

-- ───────────── timetable ─────────────
create policy tt_read on public.timetable_entries for select to authenticated using (
  is_staff(school_id) or guardian_of_section(section_id));
create policy tt_write on public.timetable_entries for all to authenticated
  using (has_perm(school_id, 'academics.manage')) with check (has_perm(school_id, 'academics.manage'));

-- ───────────── files ─────────────
create policy files_read on public.uploaded_files for select to authenticated using (
  is_staff(school_id)
  or (student_id is not null and is_guardian_of(student_id))
  or (student_id is null and category in ('form','notice','homework','exam','logo') and is_member(school_id)));
create policy files_insert on public.uploaded_files for insert to authenticated
  with check (is_staff(school_id) and uploaded_by = auth.uid());
create policy files_delete on public.uploaded_files for delete to authenticated
  using (uploaded_by = auth.uid() or has_perm(school_id, 'settings.manage'));

-- ───────────── homework ─────────────
create policy hw_read on public.homework for select to authenticated using (
  has_perm(school_id, 'homework.manage') or teaches_section(section_id)
  or (status = 'published' and guardian_of_section(section_id)));
create policy hw_write on public.homework for all to authenticated
  using (has_perm(school_id, 'homework.manage') or teaches_section(section_id))
  with check (has_perm(school_id, 'homework.manage') or teaches_section(section_id));

create policy hwf_read on public.homework_files for select to authenticated
  using (exists (select 1 from homework h where h.id = homework_id));  -- inherits homework RLS
create policy hwf_write on public.homework_files for all to authenticated
  using (exists (select 1 from homework h where h.id = homework_id
                 and (has_perm(h.school_id,'homework.manage') or teaches_section(h.section_id))))
  with check (exists (select 1 from homework h where h.id = homework_id
                 and (has_perm(h.school_id,'homework.manage') or teaches_section(h.section_id))));

create policy hws_read on public.homework_status for select to authenticated using (
  has_perm(school_id, 'homework.manage') or teaches_student(student_id) or is_guardian_of(student_id));
create policy hws_write on public.homework_status for all to authenticated
  using (has_perm(school_id, 'homework.manage') or teaches_student(student_id))
  with check (has_perm(school_id, 'homework.manage') or teaches_student(student_id));

-- ───────────── marks & results ─────────────
create policy marks_read on public.marks for select to authenticated using (
  has_perm(school_id, 'exams.manage') or has_perm(school_id, 'results.publish')
  or teaches_student(student_id)
  or (is_guardian_of(student_id) and status = 'approved' and exists (
        select 1 from exam_subjects es join exams e on e.id = es.exam_id
        where es.id = exam_subject_id and e.status = 'published')));
create policy marks_write on public.marks for insert to authenticated with check (
  (has_perm(school_id, 'marks.enter') or teaches_student(student_id))
  and status in ('draft','submitted') and entered_by = auth.uid()
  and exists (select 1 from exam_subjects es join exams e on e.id = es.exam_id
              where es.id = exam_subject_id and e.status in ('draft','marks_entry')));
create policy marks_update on public.marks for update to authenticated
  using ((has_perm(school_id, 'marks.enter') or teaches_student(student_id)) and status <> 'approved')
  with check (status in ('draft','submitted') and exists (
      select 1 from exam_subjects es join exams e on e.id = es.exam_id
      where es.id = exam_subject_id and e.status in ('draft','marks_entry')));

create or replace function public.publish_exam(p_exam uuid) returns int
language plpgsql security definer set search_path = public as $$
declare sch uuid; n int;
begin
  select school_id into sch from exams where id = p_exam for update;
  perform require_perm(sch, 'results.publish');
  update marks set status = 'approved'
   where exam_subject_id in (select id from exam_subjects where exam_id = p_exam);
  get diagnostics n = row_count;
  update exams set status = 'published', published_at = now(), published_by = auth.uid() where id = p_exam;
  perform write_audit(sch, 'exam.publish', 'exams', p_exam::text, null, jsonb_build_object('marks', n));
  return n;
end $$;

-- ───────────── notices & notifications ─────────────
create or replace function public.can_see_notice(n public.notices) returns boolean
language sql stable security definer set search_path = public as $$
  select has_perm(n.school_id, 'notices.manage') or n.created_by = auth.uid()
    or (n.is_published and is_member(n.school_id) and (
         n.audience = 'all'
      or (n.audience = 'staff' and is_staff(n.school_id))
      or (n.audience = 'guardians' and exists (select 1 from guardians g
            where g.school_id = n.school_id and g.profile_id = auth.uid()))
      or (n.audience = 'sections' and (is_staff(n.school_id)
            or exists (select 1 from unnest(n.target_ids) s where guardian_of_section(s))))
      or (n.audience = 'students' and (is_staff(n.school_id)
            or exists (select 1 from unnest(n.target_ids) s where is_guardian_of(s))))
      or (n.audience = 'users' and auth.uid() = any(n.target_ids))))
$$;

create policy notices_read on public.notices for select to authenticated using (can_see_notice(notices));
create policy notices_insert on public.notices for insert to authenticated with check (
  created_by = auth.uid() and (
    has_perm(school_id, 'notices.manage')
    or (audience = 'sections' and cardinality(target_ids) > 0
        and not exists (select 1 from unnest(target_ids) s where not teaches_section(s)))));
create policy notices_update on public.notices for update to authenticated
  using (has_perm(school_id, 'notices.manage') or created_by = auth.uid())
  with check (has_perm(school_id, 'notices.manage') or created_by = auth.uid());
create policy notices_delete on public.notices for delete to authenticated
  using (has_perm(school_id, 'notices.manage') or created_by = auth.uid());

create policy notif_read on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notif_mark_read on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- in-app notification fan-out when a notice is published (not SMS / email)
create or replace function public.fanout_notice() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not new.is_published then return new; end if;
  insert into notifications(school_id, user_id, kind, title, body, link)
  select distinct new.school_id, u.uid, 'notice', new.title, left(new.body, 200), '/notices/' || new.id
  from (
    select m.user_id uid from school_members m join roles r on r.key = m.role_key
      where m.school_id = new.school_id and m.status = 'active' and (
        new.audience = 'all'
        or (new.audience = 'staff' and r.is_staff)
        or (new.audience = 'guardians' and m.role_key = 'guardian'))
    union
    select g.profile_id from guardians g
      join student_guardians sg on sg.guardian_id = g.id
      join enrollments e on e.student_id = sg.student_id
      join academic_years y on y.id = e.academic_year_id and y.is_current
      where g.school_id = new.school_id and g.profile_id is not null and (
        (new.audience = 'sections' and e.section_id = any(new.target_ids))
        or (new.audience = 'students' and sg.student_id = any(new.target_ids)))
    union
    select unnest(new.target_ids) where new.audience = 'users'
  ) u
  where u.uid is not null and u.uid <> coalesce(new.created_by, '00000000-0000-0000-0000-000000000000'::uuid)
    and exists (select 1 from school_members m where m.user_id = u.uid and m.school_id = new.school_id
                and m.status = 'active');
  return new;
end $$;
create trigger notices_fanout after insert on public.notices
  for each row execute function public.fanout_notice();

-- ───────────── finance ─────────────
create policy fee_cat_read on public.fee_categories for select to authenticated using (is_member(school_id));
create policy fee_cat_write on public.fee_categories for all to authenticated
  using (has_perm(school_id, 'fees.configure')) with check (has_perm(school_id, 'fees.configure'));
create policy fee_struct_read on public.fee_structures for select to authenticated using (is_member(school_id));
create policy fee_struct_write on public.fee_structures for all to authenticated
  using (has_perm(school_id, 'fees.configure')) with check (has_perm(school_id, 'fees.configure'));

create policy disc_read on public.student_fee_discounts for select to authenticated using (
  has_perm(school_id, 'fees.view') or is_guardian_of(student_id));
create policy disc_write on public.student_fee_discounts for all to authenticated
  using (has_perm(school_id, 'fees.adjust')) with check (has_perm(school_id, 'fees.adjust'));

create policy items_read on public.invoice_items for select to authenticated using (
  has_perm(school_id, 'fees.view') or is_guardian_of(student_id));
create policy adj_read on public.invoice_adjustments for select to authenticated using (
  has_perm(school_id, 'fees.view')
  or exists (select 1 from invoice_items i where i.id = item_id and is_guardian_of(i.student_id)));
create policy pay_read on public.payments for select to authenticated using (
  has_perm(school_id, 'fees.view') or is_guardian_of(student_id));
create policy alloc_read on public.payment_allocations for select to authenticated using (
  has_perm(school_id, 'fees.view')
  or exists (select 1 from payments p where p.id = payment_id and is_guardian_of(p.student_id)));
create policy rev_read on public.payment_reversals for select to authenticated using (
  has_perm(school_id, 'fees.view')
  or exists (select 1 from payments p where p.id = payment_id and is_guardian_of(p.student_id)));
create policy refunds_read on public.refunds for select to authenticated using (
  has_perm(school_id, 'fees.view') or is_guardian_of(student_id));
-- no insert/update/delete policies on billing & payment tables: RPCs only

create policy exp_cat_read on public.expense_categories for select to authenticated using (
  has_perm(school_id, 'expenses.view') or has_perm(school_id, 'expenses.create'));
create policy exp_cat_write on public.expense_categories for all to authenticated
  using (has_perm(school_id, 'expenses.approve')) with check (has_perm(school_id, 'expenses.approve'));

create policy exp_read on public.expenses for select to authenticated using (
  has_perm(school_id, 'expenses.view') or created_by = auth.uid());
create policy exp_insert on public.expenses for insert to authenticated with check (
  has_perm(school_id, 'expenses.create') and created_by = auth.uid() and status = 'pending');
create policy exp_update on public.expenses for update to authenticated
  using (created_by = auth.uid() and status = 'pending')
  with check (created_by = auth.uid() and status = 'pending');
create policy exp_delete on public.expenses for delete to authenticated
  using (created_by = auth.uid() and status = 'pending');

-- ───────────── function privileges ─────────────
revoke execute on all functions in schema public from anon, public;
grant  execute on all functions in schema public to authenticated;
revoke execute on function public.bootstrap_owner(uuid, uuid) from authenticated;
revoke execute on function public.next_counter(uuid, text) from authenticated;
grant  execute on function public.bootstrap_owner(uuid, uuid) to service_role;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.invoice_item_balances to authenticated;
