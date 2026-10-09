-- Minimal register data for staff with attendance access, without requiring
-- students.view or exposing guardian contacts, addresses or medical details.
create or replace function public.attendance_roster(p_section uuid, p_date date)
returns table(student_id uuid, full_name_en text, full_name_bn text,
  student_code text, roll_no int, status text, note text, marked_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare sch uuid;
begin
  select school_id into sch from sections where id = p_section and is_active;
  if sch is null or not (has_perm(sch, 'attendance.view') or has_perm(sch, 'attendance.create') or teaches_section(p_section)) then
    raise exception 'Permission denied: attendance' using errcode = '42501';
  end if;
  if p_date is null or p_date > local_today(sch) then
    raise exception 'invalid_attendance_date' using errcode = '22023';
  end if;
  return query select s.id, s.full_name_en, s.full_name_bn, s.student_code, en.roll_no,
    a.status, a.note, a.marked_at
    from enrollments en join academic_years y on y.id = en.academic_year_id
    join students s on s.id = en.student_id
    left join student_attendance a on a.student_id = s.id and a.date = p_date
    where en.section_id = p_section and en.school_id = sch and s.school_id = sch
      and y.school_id = sch and y.is_current and en.status = 'active' and s.status = 'active'
    order by en.roll_no nulls last, s.full_name_en, s.id;
end $$;

-- Serialize submissions per section, validate the entire batch and audit changes.
-- The UI supplies expected_marked_at to detect a stale register. Existing callers
-- without that key keep their previous behavior.
create or replace function public.submit_attendance(p_section uuid, p_date date, p_entries jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare sch uuid; e jsonb; n int := 0; old_row student_attendance; today date; sid uuid; reason text;
begin
  select school_id into sch from sections where id = p_section and is_active for update;
  if sch is null then raise exception 'Unknown section' using errcode = '22023'; end if;
  today := local_today(sch);
  if not (has_perm(sch, 'attendance.create') or teaches_section(p_section)) then
    raise exception 'Permission denied: attendance' using errcode = '42501';
  end if;
  if p_date is null or p_date > today then
    raise exception 'Cannot mark attendance for a future date' using errcode = '22023';
  end if;
  if p_date < today and not has_perm(sch, 'attendance.correct') then
    raise exception 'Permission denied: attendance.correct' using errcode = '42501';
  end if;
  if p_entries is null or jsonb_typeof(p_entries) <> 'array' then
    raise exception 'invalid_attendance_entries' using errcode = '22023';
  end if;
  if jsonb_array_length(p_entries) < 1 or jsonb_array_length(p_entries) > 1000 then
    raise exception 'invalid_attendance_entries' using errcode = '22023';
  end if;
  if (select count(*) <> count(distinct value->>'student_id') from jsonb_array_elements(p_entries)) then
    raise exception 'duplicate_attendance_student' using errcode = '22023';
  end if;
  for e in select * from jsonb_array_elements(p_entries) loop
    if jsonb_typeof(e) <> 'object' or coalesce(e->>'student_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or coalesce(e->>'status','') not in ('present','absent','late','excused')
      or length(coalesce(e->>'note','')) > 300 then
      raise exception 'invalid_attendance_entries' using errcode = '22023';
    end if;
    sid := (e->>'student_id')::uuid;
    reason := nullif(trim(e->>'reason'), '');
    if p_date < today and (coalesce(length(reason),0) < 3 or length(reason) > 300) then
      raise exception 'reason_required' using errcode = '22023';
    end if;
    -- Lock the enrollment so moving or withdrawing a student cannot race a save.
    perform 1 from enrollments en join academic_years y on y.id = en.academic_year_id
      join students s on s.id = en.student_id
      where en.student_id = sid and en.section_id = p_section and en.school_id = sch
        and y.school_id = sch and y.is_current and en.status = 'active'
        and s.school_id = sch and s.status = 'active' for update of en, s;
    if not found then raise exception 'Student is not enrolled in this section' using errcode = '22023'; end if;
    select * into old_row from student_attendance where student_id = sid and date = p_date for update;
    if e ? 'expected_marked_at' and old_row.marked_at is distinct from (e->>'expected_marked_at')::timestamptz then
      raise exception 'attendance_conflict' using errcode = '40001';
    end if;
    -- A retry with the same values is harmless and keeps its version unchanged.
    if old_row.id is not null and old_row.status = e->>'status'
      and coalesce(old_row.note, '') = coalesce(trim(e->>'note'), '') and old_row.section_id = p_section then
      n := n + 1;
      continue;
    end if;
    insert into student_attendance(school_id, student_id, section_id, date, status, note, marked_by)
      values (sch, sid, p_section, p_date, e->>'status', nullif(trim(e->>'note'), ''), auth.uid())
    on conflict (student_id, date) do update set status = excluded.status, note = excluded.note,
      marked_by = auth.uid(), marked_at = clock_timestamp(), section_id = excluded.section_id;
    perform write_audit(sch, case when p_date < today then 'attendance.correct' else 'attendance.save' end,
      'student_attendance', sid::text || ':' || p_date::text,
      case when old_row.id is not null then jsonb_build_object('status', old_row.status, 'note', old_row.note) end,
      jsonb_build_object('status', e->>'status', 'note', nullif(trim(e->>'note'), ''), 'section_id', p_section), reason);
    n := n + 1;
  end loop;
  return n;
end $$;

-- Viewing attendance must work for attendance-only staff too.
drop policy att_read on public.student_attendance;
create policy att_read on public.student_attendance for select to authenticated using (
  has_perm(school_id, 'attendance.view') or has_perm(school_id, 'attendance.create')
  or teaches_section(section_id) or is_guardian_of(student_id));
revoke all on function public.attendance_roster(uuid,date) from public, anon;
grant execute on function public.attendance_roster(uuid,date) to authenticated;
revoke all on function public.submit_attendance(uuid,date,jsonb) from public, anon;
grant execute on function public.submit_attendance(uuid,date,jsonb) to authenticated;
