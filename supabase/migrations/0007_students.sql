-- 0007_students.sql — student directory, admission, editing, status changes

-- a retried admission (double tap, flaky network) returns the first student, never a duplicate
alter table public.students add column if not exists request_id uuid unique;

-- One row per student with their current class and primary guardian.
-- security_invoker: every underlying table's RLS still applies to whoever queries it.
create or replace view public.student_directory with (security_invoker = true) as
select s.id, s.school_id, s.student_code, s.admission_no, s.full_name_en, s.full_name_bn,
       s.gender, s.date_of_birth, s.blood_group, s.status, s.admission_date, s.photo_path, s.address,
       e.id as enrollment_id, e.roll_no, e.section_id,
       sec.name as section_name, c.id as class_id, c.name_en as class_name_en, c.name_bn as class_name_bn,
       c.sort_order as class_order,
       g.id as guardian_id, g.full_name as guardian_name, g.phone as guardian_phone,
       sg.relationship as guardian_relationship
from public.students s
left join lateral (
  select en.* from public.enrollments en
  join public.academic_years y on y.id = en.academic_year_id and y.is_current
  where en.student_id = s.id limit 1) e on true
left join public.sections sec on sec.id = e.section_id
left join public.classes c on c.id = sec.class_id
left join lateral (
  select x.* from public.student_guardians x where x.student_id = s.id
  order by x.is_primary desc, x.relationship limit 1) sg on true
left join public.guardians g on g.id = sg.guardian_id;

grant select on public.student_directory to authenticated;

create or replace function public.normalize_bd_phone(p text) returns text
language sql immutable as $$
  -- keep digits; +8801711… / 8801711… / 01711… all become 01711…
  select case
    when p is null or regexp_replace(p, '\D', '', 'g') = '' then null
    when regexp_replace(p, '\D', '', 'g') ~ '^8801\d{9}$' then substr(regexp_replace(p, '\D', '', 'g'), 3)
    else regexp_replace(p, '\D', '', 'g') end
$$;

-- shared validation for admit/update
create or replace function public._student_fields_check(p jsonb) returns void
language plpgsql immutable as $$
begin
  if coalesce(trim(p->>'full_name_en'), '') = '' and coalesce(trim(p->>'full_name_bn'), '') = '' then
    raise exception 'name_required' using errcode = '22023';
  end if;
  if nullif(p->>'gender','') is not null and p->>'gender' not in ('male','female','other') then
    raise exception 'invalid_gender' using errcode = '22023';
  end if;
  if nullif(p->>'roll_no','') is not null and (p->>'roll_no') !~ '^\d{1,6}$' then
    raise exception 'invalid_roll' using errcode = '22023';
  end if;
  if nullif(p->>'roll_no','') is not null and (p->>'roll_no')::int <= 0 then
    raise exception 'invalid_roll' using errcode = '22023';
  end if;
end $$;

-- Admit a new student in one transaction: student + current-year enrollment + guardian link.
create or replace function public.admit_student(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare sec sections; yr uuid; sid uuid; gid uuid; roll int; ph text; existing uuid;
begin
  select * into sec from sections where id = nullif(p->>'section_id','')::uuid;
  if not found then raise exception 'class_required' using errcode = '22023'; end if;
  perform require_perm(sec.school_id, 'students.create');

  if nullif(p->>'request_id','') is not null then
    select id into existing from students where request_id = (p->>'request_id')::uuid and school_id = sec.school_id;
    if found then return existing; end if;
  end if;

  perform _student_fields_check(p);
  select id into yr from academic_years where school_id = sec.school_id and is_current;
  if yr is null then raise exception 'no_current_year' using errcode = '22023'; end if;

  -- serialize admissions per section so automatic roll numbers never collide
  perform 1 from sections where id = sec.id for update;
  roll := nullif(p->>'roll_no','')::int;
  if roll is null then
    select coalesce(max(roll_no), 0) + 1 into roll from enrollments
     where section_id = sec.id and academic_year_id = yr and status = 'active';
  elsif exists (select 1 from enrollments where section_id = sec.id and academic_year_id = yr
                 and roll_no = roll and status = 'active') then
    raise exception 'duplicate_roll' using errcode = '23505';
  end if;

  if nullif(trim(p->>'admission_no'),'') is not null and exists (
     select 1 from students where school_id = sec.school_id and admission_no = trim(p->>'admission_no')) then
    raise exception 'duplicate_admission_no' using errcode = '23505';
  end if;

  insert into students(school_id, admission_no, full_name_en, full_name_bn, date_of_birth, gender,
                       blood_group, admission_date, address, emergency_contact_name,
                       emergency_contact_phone, status, created_by, request_id)
  values (sec.school_id, nullif(trim(p->>'admission_no'),''),
          coalesce(nullif(trim(p->>'full_name_en'),''), trim(p->>'full_name_bn')),
          nullif(trim(p->>'full_name_bn'),''), nullif(p->>'date_of_birth','')::date,
          nullif(p->>'gender',''), nullif(p->>'blood_group',''),
          coalesce(nullif(p->>'admission_date','')::date, local_today(sec.school_id)),
          nullif(trim(p->>'address'),''), nullif(trim(p->>'emergency_contact_name'),''),
          normalize_bd_phone(p->>'emergency_contact_phone'), 'active', auth.uid(),
          nullif(p->>'request_id','')::uuid)
  returning id into sid;

  insert into enrollments(school_id, student_id, academic_year_id, section_id, roll_no)
  values (sec.school_id, sid, yr, sec.id, roll);

  -- guardian: reuse one with the same phone (a brother or sister is already enrolled)
  ph := normalize_bd_phone(p->>'guardian_phone');
  if coalesce(trim(p->>'guardian_name'),'') <> '' or ph is not null then
    if ph is not null then
      select id into gid from guardians where school_id = sec.school_id and phone = ph limit 1;
    end if;
    if gid is null then
      insert into guardians(school_id, full_name, phone, email, address)
      values (sec.school_id, coalesce(nullif(trim(p->>'guardian_name'),''), ph), ph,
              nullif(lower(trim(p->>'guardian_email')),''), nullif(trim(p->>'address'),''))
      returning id into gid;
    end if;
    insert into student_guardians(student_id, guardian_id, school_id, relationship, is_primary)
    values (sid, gid, sec.school_id, coalesce(nullif(p->>'guardian_relationship',''), 'father'), true);
  end if;

  perform write_audit(sec.school_id, 'student.admit', 'students', sid::text, null,
    jsonb_build_object('name', coalesce(nullif(trim(p->>'full_name_en'),''), p->>'full_name_bn'),
                       'section_id', sec.id, 'roll_no', roll, 'guardian_id', gid));
  return sid;
end $$;

-- Edit details and (optionally) move class/roll for the current year.
create or replace function public.update_student(p_id uuid, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare st students; before jsonb; sec sections; yr uuid; roll int; en enrollments;
begin
  select * into st from students where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  perform require_perm(st.school_id, 'students.edit');
  perform _student_fields_check(p);
  before := to_jsonb(st) - 'request_id';

  if nullif(trim(p->>'admission_no'),'') is not null and exists (
     select 1 from students where school_id = st.school_id and admission_no = trim(p->>'admission_no') and id <> p_id) then
    raise exception 'duplicate_admission_no' using errcode = '23505';
  end if;

  update students set
    admission_no = nullif(trim(p->>'admission_no'),''),
    full_name_en = coalesce(nullif(trim(p->>'full_name_en'),''), trim(p->>'full_name_bn')),
    full_name_bn = nullif(trim(p->>'full_name_bn'),''),
    date_of_birth = nullif(p->>'date_of_birth','')::date,
    gender = nullif(p->>'gender',''),
    blood_group = nullif(p->>'blood_group',''),
    admission_date = coalesce(nullif(p->>'admission_date','')::date, admission_date),
    address = nullif(trim(p->>'address'),''),
    emergency_contact_name = nullif(trim(p->>'emergency_contact_name'),''),
    emergency_contact_phone = normalize_bd_phone(p->>'emergency_contact_phone')
  where id = p_id;

  -- class / roll change for the current year
  if nullif(p->>'section_id','') is not null then
    select * into sec from sections where id = (p->>'section_id')::uuid and school_id = st.school_id;
    if not found then raise exception 'class_required' using errcode = '22023'; end if;
    select id into yr from academic_years where school_id = st.school_id and is_current;
    perform 1 from sections where id = sec.id for update;
    select * into en from enrollments where student_id = p_id and academic_year_id = yr for update;
    roll := nullif(p->>'roll_no','')::int;
    if roll is null then
      if en.section_id = sec.id then roll := en.roll_no;
      else select coalesce(max(roll_no),0)+1 into roll from enrollments
            where section_id = sec.id and academic_year_id = yr and status = 'active';
      end if;
    end if;
    if exists (select 1 from enrollments where section_id = sec.id and academic_year_id = yr
               and roll_no = roll and status = 'active' and student_id <> p_id) then
      raise exception 'duplicate_roll' using errcode = '23505';
    end if;
    if en.id is null then
      insert into enrollments(school_id, student_id, academic_year_id, section_id, roll_no)
      values (st.school_id, p_id, yr, sec.id, roll);
    else
      update enrollments set section_id = sec.id, roll_no = roll where id = en.id;
    end if;
  end if;

  perform write_audit(st.school_id, 'student.update', 'students', p_id::text, before,
    (select to_jsonb(s) - 'request_id' from students s where s.id = p_id));
end $$;

-- Mark a student as left / graduated / transferred, or bring them back. Never deletes.
create or replace function public.set_student_status(p_id uuid, p_status text, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare st students;
begin
  select * into st from students where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  perform require_perm(st.school_id, 'students.archive');
  if p_status not in ('active','graduated','withdrawn','transferred') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  if p_status <> 'active' and coalesce(length(trim(p_reason)),0) < 3 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  update students set status = p_status where id = p_id;
  if p_status = 'active' then
    -- coming back: keep the old roll if still free, otherwise take the next one
    update enrollments en set status = 'active',
      roll_no = case when exists (select 1 from enrollments o where o.section_id = en.section_id
                        and o.academic_year_id = en.academic_year_id and o.roll_no = en.roll_no
                        and o.status = 'active' and o.id <> en.id)
                     then (select coalesce(max(o.roll_no),0)+1 from enrollments o where o.section_id = en.section_id
                           and o.academic_year_id = en.academic_year_id and o.status = 'active')
                     else en.roll_no end
     where en.student_id = p_id
       and en.academic_year_id = (select id from academic_years where school_id = st.school_id and is_current);
  else
    update enrollments set status = 'left'
     where student_id = p_id
       and academic_year_id = (select id from academic_years where school_id = st.school_id and is_current);
  end if;
  perform write_audit(st.school_id, 'student.status', 'students', p_id::text,
    jsonb_build_object('status', st.status), jsonb_build_object('status', p_status), p_reason);
end $$;

revoke execute on function public.admit_student(jsonb), public.update_student(uuid, jsonb),
  public.set_student_status(uuid, text, text) from public, anon;
grant execute on function public.admit_student(jsonb), public.update_student(uuid, jsonb),
  public.set_student_status(uuid, text, text), public.normalize_bd_phone(text) to authenticated;
