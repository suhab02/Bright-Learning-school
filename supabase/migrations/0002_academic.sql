-- 0002_academic.sql — academic structure, people, attendance, homework, exams, notices

-- gap-free counters (student codes, receipt numbers) — always row-locked
create table public.school_counters (
  school_id uuid references public.schools(id) on delete cascade,
  key       text,
  value     bigint not null default 0,
  primary key (school_id, key)
);

create or replace function public.next_counter(p_school uuid, p_key text) returns bigint
language plpgsql security definer set search_path = public as $$
declare v bigint;
begin
  insert into school_counters(school_id, key, value) values (p_school, p_key, 1)
  on conflict (school_id, key) do update set value = school_counters.value + 1
  returning value into v;
  return v;
end $$;
revoke all on function public.next_counter(uuid, text) from public, anon, authenticated;

-- ───────────── academic structure ─────────────
create table public.academic_years (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  name        text not null,                 -- '2026'
  starts_on   date not null,
  ends_on     date not null,
  is_current  boolean not null default false,
  check (ends_on > starts_on),
  unique (school_id, name)
);
create unique index one_current_year on public.academic_years(school_id) where is_current;

create table public.classes (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  name_en     text not null,
  name_bn     text not null,
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  unique (school_id, name_en)
);

create table public.sections (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  class_id    uuid not null references public.classes(id) on delete restrict,
  name        text not null default 'A',
  room        text,
  capacity    int check (capacity > 0),
  is_active   boolean not null default true,
  unique (class_id, name)
);

create table public.subjects (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  name_en     text not null,
  name_bn     text not null,
  code        text,
  unique (school_id, name_en)
);

create table public.class_subjects (
  class_id   uuid references public.classes(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete cascade,
  primary key (class_id, subject_id)
);

-- ───────────── staff ─────────────
create table public.staff (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  profile_id   uuid references public.profiles(id) on delete set null,
  staff_code   text not null,
  full_name_en text not null,
  full_name_bn text,
  designation  text,
  phone        text,
  email        text,
  photo_path   text,
  joining_date date,
  status       text not null default 'active' check (status in ('active','on_leave','resigned')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (school_id, staff_code)
);
create unique index staff_profile_unique on public.staff(school_id, profile_id) where profile_id is not null;

-- salary kept separate so it can have stricter access
create table public.staff_salaries (
  staff_id          uuid primary key references public.staff(id) on delete cascade,
  school_id         uuid not null references public.schools(id) on delete cascade,
  monthly_salary    bigint not null check (monthly_salary >= 0),  -- poisha
  effective_from    date not null default current_date
);

create table public.teacher_assignments (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools(id) on delete cascade,
  staff_id         uuid not null references public.staff(id) on delete cascade,
  section_id       uuid not null references public.sections(id) on delete cascade,
  subject_id       uuid references public.subjects(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  is_class_teacher boolean not null default false
);
create unique index ta_unique on public.teacher_assignments
  (staff_id, section_id, coalesce(subject_id, '00000000-0000-0000-0000-000000000000'::uuid), academic_year_id);
create unique index one_class_teacher on public.teacher_assignments(section_id, academic_year_id)
  where is_class_teacher;

create table public.staff_attendance (
  id        uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  staff_id  uuid not null references public.staff(id) on delete cascade,
  date      date not null,
  status    text not null check (status in ('present','absent','late','leave')),
  note      text,
  marked_by uuid references auth.users(id),
  unique (staff_id, date)
);

-- ───────────── students & guardians ─────────────
create table public.students (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools(id) on delete cascade,
  student_code     text not null,
  admission_no     text,
  full_name_en     text not null,
  full_name_bn     text,
  photo_path       text,
  date_of_birth    date,
  gender           text check (gender in ('male','female','other')),
  blood_group      text check (blood_group in ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  admission_date   date not null default current_date,
  address          text,
  emergency_contact_name  text,
  emergency_contact_phone text,
  pickup_contacts  jsonb not null default '[]'::jsonb,
  status           text not null default 'active'
                   check (status in ('applicant','active','graduated','withdrawn','transferred')),
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (school_id, student_code),
  unique (school_id, admission_no)
);
create index students_name_idx on public.students(school_id, lower(full_name_en));

-- medical notes in their own table: staff with students.edit + guardians of that child only
create table public.student_medical_notes (
  student_id uuid primary key references public.students(id) on delete cascade,
  school_id  uuid not null references public.schools(id) on delete cascade,
  notes      text not null,
  updated_at timestamptz not null default now()
);

create table public.guardians (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  profile_id  uuid references public.profiles(id) on delete set null,
  full_name   text not null,
  phone       text,
  email       text,
  address     text,
  occupation  text,
  status      text not null default 'active' check (status in ('active','inactive')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index guardians_profile_unique on public.guardians(school_id, profile_id) where profile_id is not null;
create index on public.guardians(school_id, phone);

create table public.student_guardians (
  student_id   uuid references public.students(id) on delete cascade,
  guardian_id  uuid references public.guardians(id) on delete cascade,
  school_id    uuid not null references public.schools(id) on delete cascade,
  relationship text not null check (relationship in ('father','mother','legal_guardian','other')),
  is_primary   boolean not null default false,
  can_pickup   boolean not null default true,
  primary key (student_id, guardian_id)
);
create index on public.student_guardians(guardian_id);

-- which section a student is in for a given year (history preserved across promotions)
create table public.enrollments (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools(id) on delete cascade,
  student_id       uuid not null references public.students(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  section_id       uuid not null references public.sections(id) on delete restrict,
  roll_no          int check (roll_no > 0),
  status           text not null default 'active' check (status in ('active','promoted','repeated','left')),
  created_at       timestamptz not null default now(),
  unique (student_id, academic_year_id)
);
create unique index enrollment_roll_unique on public.enrollments(section_id, academic_year_id, roll_no)
  where roll_no is not null and status = 'active';
create index on public.enrollments(section_id, academic_year_id);

-- ───────────── access helpers ─────────────
create or replace function public.my_staff_id(p_school uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select id from staff where school_id = p_school and profile_id = auth.uid() and status <> 'resigned'
$$;

create or replace function public.teaches_section(p_section uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from teacher_assignments ta
    join staff s on s.id = ta.staff_id
    join academic_years y on y.id = ta.academic_year_id and y.is_current
    join school_members m on m.school_id = s.school_id and m.user_id = auth.uid() and m.status = 'active'
    where ta.section_id = p_section and s.profile_id = auth.uid() and s.status <> 'resigned')
$$;

create or replace function public.teaches_student(p_student uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from enrollments e
    join academic_years y on y.id = e.academic_year_id and y.is_current
    where e.student_id = p_student and public.teaches_section(e.section_id))
$$;

create or replace function public.is_guardian_of(p_student uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from student_guardians sg
    join guardians g on g.id = sg.guardian_id
    join school_members m on m.school_id = g.school_id and m.user_id = auth.uid() and m.status = 'active'
    where sg.student_id = p_student and g.profile_id = auth.uid() and g.status = 'active')
$$;

create or replace function public.guardian_of_section(p_section uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from enrollments e
    join academic_years y on y.id = e.academic_year_id and y.is_current
    where e.section_id = p_section and e.status = 'active' and public.is_guardian_of(e.student_id))
$$;

-- generate student code server-side: <YEAR>-<0001>
create or replace function public.set_student_code() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.student_code is null or new.student_code = '' then
    new.student_code := to_char(coalesce(new.admission_date, current_date), 'YYYY') || '-' ||
      lpad(next_counter(new.school_id, 'student')::text, 4, '0');
  end if;
  return new;
end $$;
create trigger students_code before insert on public.students
  for each row execute function public.set_student_code();

create or replace function public.set_staff_code() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.staff_code is null or new.staff_code = '' then
    new.staff_code := 'T-' || lpad(next_counter(new.school_id, 'staff')::text, 3, '0');
  end if;
  return new;
end $$;
create trigger staff_code before insert on public.staff
  for each row execute function public.set_staff_code();

create trigger students_touch  before update on public.students  for each row execute function public.touch_updated_at();
create trigger guardians_touch before update on public.guardians for each row execute function public.touch_updated_at();
create trigger staff_touch     before update on public.staff     for each row execute function public.touch_updated_at();

-- ───────────── student attendance ─────────────
create table public.student_attendance (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  student_id  uuid not null references public.students(id) on delete cascade,
  section_id  uuid not null references public.sections(id) on delete restrict,
  date        date not null,
  status      text not null check (status in ('present','absent','late','excused')),
  note        text,
  marked_by   uuid references auth.users(id),
  marked_at   timestamptz not null default now(),
  unique (student_id, date)
);
create index on public.student_attendance(school_id, date);
create index on public.student_attendance(section_id, date);

-- Submit a whole section's attendance atomically. Same day re-submit by the marker updates;
-- changes to a past date require attendance.correct and are audited.
create or replace function public.submit_attendance(
  p_section uuid, p_date date, p_entries jsonb)  -- [{"student_id":..,"status":..,"note":..}]
returns int language plpgsql security definer set search_path = public as $$
declare sch uuid; e jsonb; n int := 0; old_row student_attendance; today date;
begin
  select school_id into sch from sections where id = p_section;
  if sch is null then raise exception 'Unknown section'; end if;
  select (now() at time zone s.timezone)::date into today from schools s where s.id = sch;
  if p_date > today then raise exception 'Cannot mark attendance for a future date'; end if;

  if not (has_perm(sch, 'attendance.create') or teaches_section(p_section)) then
    raise exception 'Permission denied: attendance' using errcode = '42501';
  end if;
  if p_date < today and not has_perm(sch, 'attendance.correct') then
    raise exception 'Permission denied: attendance.correct' using errcode = '42501';
  end if;

  for e in select * from jsonb_array_elements(p_entries) loop
    if not exists (select 1 from enrollments en join academic_years y on y.id = en.academic_year_id
                   where en.student_id = (e->>'student_id')::uuid and en.section_id = p_section
                     and y.is_current and en.status = 'active') then
      raise exception 'Student % is not enrolled in this section', e->>'student_id';
    end if;
    select * into old_row from student_attendance
      where student_id = (e->>'student_id')::uuid and date = p_date for update;
    insert into student_attendance(school_id, student_id, section_id, date, status, note, marked_by)
    values (sch, (e->>'student_id')::uuid, p_section, p_date, e->>'status', e->>'note', auth.uid())
    on conflict (student_id, date) do update
      set status = excluded.status, note = excluded.note, marked_by = auth.uid(), marked_at = now(),
          section_id = excluded.section_id;
    if old_row.id is not null and old_row.status <> (e->>'status') and p_date < today then
      perform write_audit(sch, 'attendance.correct', 'student_attendance', old_row.id::text,
        jsonb_build_object('status', old_row.status), jsonb_build_object('status', e->>'status'),
        e->>'reason');
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;

-- ───────────── timetable & calendar ─────────────
create table public.periods (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  name       text not null,
  starts_at  time not null,
  ends_at    time not null,
  sort_order int not null default 0,
  check (ends_at > starts_at)
);

create table public.timetable_entries (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  section_id       uuid not null references public.sections(id) on delete cascade,
  weekday          smallint not null check (weekday between 0 and 6),  -- 0 = Sunday
  period_id        uuid not null references public.periods(id) on delete cascade,
  subject_id       uuid references public.subjects(id) on delete set null,
  staff_id         uuid references public.staff(id) on delete set null,
  room             text,
  unique (section_id, academic_year_id, weekday, period_id)
);
create unique index teacher_no_double_booking on public.timetable_entries(staff_id, academic_year_id, weekday, period_id)
  where staff_id is not null;

create table public.calendar_events (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  title_en    text not null,
  title_bn    text,
  kind        text not null check (kind in ('holiday','exam','deadline','event')),
  starts_on   date not null,
  ends_on     date not null,
  check (ends_on >= starts_on)
);

-- working days: 0=Sun .. 6=Sat; Bangladesh default Sun–Thu
alter table public.schools add column working_days smallint[] not null default '{0,1,2,3,4}';
alter table public.schools add column school_starts time default '08:00';
alter table public.schools add column school_ends   time default '13:00';

-- ───────────── files ─────────────
create table public.uploaded_files (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  bucket      text not null,
  path        text not null,
  file_name   text not null,
  mime_type   text,
  size_bytes  bigint check (size_bytes >= 0 and size_bytes <= 10485760),
  category    text not null default 'general'
              check (category in ('general','form','notice','homework','exam','student','expense_receipt','logo')),
  student_id  uuid references public.students(id) on delete cascade,
  uploaded_by uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  unique (bucket, path)
);

-- ───────────── homework ─────────────
create table public.homework (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools(id) on delete cascade,
  section_id       uuid not null references public.sections(id) on delete cascade,
  subject_id       uuid references public.subjects(id) on delete set null,
  title            text not null,
  instructions     text,
  due_on           date,
  status           text not null default 'draft' check (status in ('draft','published','archived')),
  allow_submissions boolean not null default false,
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now(),
  published_at     timestamptz
);
create index on public.homework(section_id, status, due_on);

create table public.homework_files (
  homework_id uuid references public.homework(id) on delete cascade,
  file_id     uuid references public.uploaded_files(id) on delete cascade,
  primary key (homework_id, file_id)
);

create table public.homework_status (
  homework_id  uuid references public.homework(id) on delete cascade,
  student_id   uuid references public.students(id) on delete cascade,
  school_id    uuid not null references public.schools(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending','submitted','completed','late')),
  submission_file_id uuid references public.uploaded_files(id) on delete set null,
  teacher_note text,
  updated_at   timestamptz not null default now(),
  primary key (homework_id, student_id)
);

-- ───────────── exams & results ─────────────
create table public.grade_scales (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  name       text not null,
  is_default boolean not null default false
);
create unique index one_default_scale on public.grade_scales(school_id) where is_default;

create table public.grade_bands (
  id          uuid primary key default gen_random_uuid(),
  scale_id    uuid not null references public.grade_scales(id) on delete cascade,
  min_percent numeric(5,2) not null check (min_percent between 0 and 100),
  max_percent numeric(5,2) not null check (max_percent between 0 and 100),
  grade       text not null,
  grade_point numeric(3,2) not null,
  check (max_percent >= min_percent)
);

create table public.exams (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  name_en          text not null,
  name_bn          text,
  kind             text not null check (kind in ('class_test','monthly','half_yearly','annual','custom')),
  grade_scale_id   uuid references public.grade_scales(id),
  starts_on        date,
  ends_on          date,
  status           text not null default 'draft'
                   check (status in ('draft','marks_entry','under_review','published')),
  published_at     timestamptz,
  published_by     uuid references auth.users(id)
);

create table public.exam_subjects (
  id         uuid primary key default gen_random_uuid(),
  exam_id    uuid not null references public.exams(id) on delete cascade,
  class_id   uuid not null references public.classes(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  full_marks numeric(6,2) not null check (full_marks > 0),
  pass_marks numeric(6,2) not null check (pass_marks >= 0),
  exam_date  date,
  check (pass_marks <= full_marks),
  unique (exam_id, class_id, subject_id)
);

create table public.marks (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references public.schools(id) on delete cascade,
  exam_subject_id uuid not null references public.exam_subjects(id) on delete cascade,
  student_id      uuid not null references public.students(id) on delete cascade,
  marks_obtained  numeric(6,2) check (marks_obtained >= 0),
  is_absent       boolean not null default false,
  status          text not null default 'draft' check (status in ('draft','submitted','approved')),
  entered_by      uuid references auth.users(id),
  updated_at      timestamptz not null default now(),
  unique (exam_subject_id, student_id)
);

create or replace function public.check_marks() returns trigger
language plpgsql as $$
declare fm numeric;
begin
  select full_marks into fm from exam_subjects where id = new.exam_subject_id;
  if new.marks_obtained is not null and new.marks_obtained > fm then
    raise exception 'Marks (%) exceed full marks (%)', new.marks_obtained, fm using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger marks_check before insert or update on public.marks
  for each row execute function public.check_marks();

-- ───────────── notices & notifications ─────────────
create table public.notices (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id) on delete cascade,
  kind          text not null default 'general' check (kind in
                ('general','holiday','exam','payment','class_cancel','homework','emergency','admin')),
  title         text not null,
  body          text not null,
  audience      text not null check (audience in ('all','staff','guardians','sections','students','users')),
  target_ids    uuid[] not null default '{}',   -- section ids / student ids / user ids
  attachment_id uuid references public.uploaded_files(id) on delete set null,
  is_published  boolean not null default true,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now()
);
create index on public.notices(school_id, created_at desc);

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null,
  title      text not null,
  body       text,
  link       text,                          -- in-app deep link
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications(user_id, read_at, created_at desc);
