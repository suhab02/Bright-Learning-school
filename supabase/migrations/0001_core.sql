-- 0001_core.sql — schools, profiles, roles, permissions, invitations, audit
create extension if not exists pgcrypto;

-- ───────────────────────── schools (all details editable) ─────────────────────────
create table public.schools (
  id                 uuid primary key default gen_random_uuid(),
  name_bn            text not null,
  name_en            text not null,
  slogan_bn          text,
  slogan_en          text,
  description        text,
  head_teacher_name  text,
  address_line       text,
  village_area       text,
  union_name         text,
  upazila            text,
  district           text,
  division           text,
  postal_code        text,
  phone              text,
  whatsapp           text,
  email              text,
  website            text,
  maps_url           text,
  latitude           numeric(9,6),
  longitude          numeric(9,6),
  established_year   int check (established_year between 1800 and 2200),
  registration_no    text,
  logo_path          text,
  favicon_path       text,
  primary_color      text not null default '#17356B' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  theme              text not null default 'system' check (theme in ('light','dark','system')),
  default_locale     text not null default 'bn' check (default_locale in ('bn','en')),
  use_bengali_digits boolean not null default true,
  receipt_header     text,
  report_header      text,
  receipt_prefix     text not null default 'RCP' check (receipt_prefix ~ '^[A-Z0-9-]{1,12}$'),
  timezone           text not null default 'Asia/Dhaka',
  onboarding_done    boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ───────────────────────── profiles (1:1 with auth.users) ─────────────────────────
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text,
  email        text,
  phone        text,
  avatar_path  text,
  locale       text check (locale in ('bn','en')),
  last_login_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ───────────────────────── roles & permissions ─────────────────────────
create table public.permissions (
  key          text primary key,            -- e.g. 'fees.collect'
  module       text not null,
  description  text not null
);

create table public.roles (
  key          text primary key,            -- super_admin | admin | accountant | teacher | guardian
  name_en      text not null,
  name_bn      text not null,
  is_staff     boolean not null default true
);

create table public.role_permissions (
  role_key       text references public.roles(key) on delete cascade,
  permission_key text references public.permissions(key) on delete cascade,
  primary key (role_key, permission_key)
);

-- one membership per (school, user); role defines defaults
create table public.school_members (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role_key    text not null references public.roles(key),
  status      text not null default 'active' check (status in ('active','suspended')),
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (school_id, user_id)
);
create index on public.school_members(user_id);

-- per-user grant/revoke on top of role defaults
create table public.member_permission_overrides (
  member_id      uuid references public.school_members(id) on delete cascade,
  permission_key text references public.permissions(key) on delete cascade,
  granted        boolean not null,
  primary key (member_id, permission_key)
);

create table public.invitations (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  email        text not null,
  role_key     text not null references public.roles(key) check (role_key <> 'super_admin'),
  permissions  jsonb not null default '{}'::jsonb,   -- {"fees.collect": true, ...}
  guardian_id  uuid,                                 -- set when inviting a guardian record
  staff_id     uuid,                                 -- set when inviting a staff record
  token_hash   text not null unique,
  expires_at   timestamptz not null default now() + interval '7 days',
  accepted_at  timestamptz,
  accepted_by  uuid references auth.users(id),
  revoked_at   timestamptz,
  invited_by   uuid not null references auth.users(id),
  created_at   timestamptz not null default now()
);
create index on public.invitations(school_id, lower(email));

-- ───────────────────────── audit log (append-only) ─────────────────────────
create table public.audit_logs (
  id          bigint generated always as identity primary key,
  school_id   uuid references public.schools(id) on delete cascade,
  actor_id    uuid,
  action      text not null,
  table_name  text,
  record_id   text,
  before_data jsonb,
  after_data  jsonb,
  reason      text,
  created_at  timestamptz not null default now()
);
create index on public.audit_logs(school_id, created_at desc);

create or replace function public.block_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'Records in % cannot be modified or deleted', tg_table_name
    using errcode = '42501';
end $$;

create trigger audit_logs_immutable before update or delete on public.audit_logs
  for each row execute function public.block_mutation();

-- ───────────────────────── helper functions (used by RLS) ─────────────────────────
-- current member row for a school
create or replace function public.current_member(p_school uuid)
returns public.school_members
language sql stable security definer set search_path = public as $$
  select m.* from school_members m
  where m.school_id = p_school and m.user_id = auth.uid() and m.status = 'active'
  limit 1
$$;

create or replace function public.is_member(p_school uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from school_members
                 where school_id = p_school and user_id = auth.uid() and status = 'active')
$$;

create or replace function public.is_staff(p_school uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from school_members m join roles r on r.key = m.role_key
                 where m.school_id = p_school and m.user_id = auth.uid()
                   and m.status = 'active' and r.is_staff)
$$;

create or replace function public.is_super_admin(p_school uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from school_members
                 where school_id = p_school and user_id = auth.uid()
                   and status = 'active' and role_key = 'super_admin')
$$;

-- effective permission = super_admin OR override OR role default
create or replace function public.has_perm(p_school uuid, p_perm text) returns boolean
language sql stable security definer set search_path = public as $$
  with m as (
    select id, role_key from school_members
    where school_id = p_school and user_id = auth.uid() and status = 'active'
  )
  select coalesce(
    (select true from m where role_key = 'super_admin'),
    (select o.granted from member_permission_overrides o join m on o.member_id = m.id
      where o.permission_key = p_perm),
    (select true from role_permissions rp join m on rp.role_key = m.role_key
      where rp.permission_key = p_perm),
    false)
$$;

create or replace function public.require_perm(p_school uuid, p_perm text) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_perm(p_school, p_perm) then
    raise exception 'Permission denied: %', p_perm using errcode = '42501';
  end if;
end $$;

create or replace function public.write_audit(
  p_school uuid, p_action text, p_table text, p_record text,
  p_before jsonb default null, p_after jsonb default null, p_reason text default null)
returns void language sql security definer set search_path = public as $$
  insert into audit_logs(school_id, actor_id, action, table_name, record_id,
                         before_data, after_data, reason)
  values (p_school, auth.uid(), p_action, p_table, p_record, p_before, p_after, p_reason)
$$;

-- updated_at helper
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

create trigger schools_touch  before update on public.schools  for each row execute function public.touch_updated_at();
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger members_touch  before update on public.school_members for each row execute function public.touch_updated_at();

-- ───────────── protect the Super Admin ─────────────
create or replace function public.protect_super_admin() returns trigger
language plpgsql security definer set search_path = public as $$
declare remaining int;
begin
  if tg_op in ('UPDATE','DELETE') and old.role_key = 'super_admin' then
    if tg_op = 'UPDATE' and new.role_key = 'super_admin' and new.status = 'active' then
      return new;
    end if;
    select count(*) into remaining from school_members
      where school_id = old.school_id and role_key = 'super_admin' and status = 'active'
        and id <> old.id;
    if remaining = 0 then
      raise exception 'The last Super Admin cannot be removed, suspended or demoted'
        using errcode = '42501';
    end if;
  end if;
  -- only an existing super admin (or the privileged server bootstrap) may create one
  if tg_op in ('INSERT','UPDATE') and new.role_key = 'super_admin'
     and (tg_op = 'INSERT' or old.role_key <> 'super_admin')
     and coalesce(current_setting('app.bootstrap', true), '') <> 'on'
     and not public.is_super_admin(new.school_id) then
    raise exception 'Only a Super Admin can grant Super Admin' using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;

create trigger school_members_protect
  before insert or update or delete on public.school_members
  for each row execute function public.protect_super_admin();

-- ───────────── auto-create profile on signup ─────────────
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles(id, email, full_name, avatar_path)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
          new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────── bootstrap: first owner (called by server with service role) ─────────────
-- Server verifies email == BOOTSTRAP_OWNER_EMAIL and that it is verified before calling.
create or replace function public.bootstrap_owner(p_user uuid, p_school uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from school_members where school_id = p_school and role_key = 'super_admin') then
    raise exception 'School already has a Super Admin' using errcode = '42501';
  end if;
  perform set_config('app.bootstrap', 'on', true);
  insert into school_members(school_id, user_id, role_key) values (p_school, p_user, 'super_admin');
  perform set_config('app.bootstrap', 'off', true);
  insert into audit_logs(school_id, actor_id, action, table_name, record_id)
  values (p_school, p_user, 'owner.bootstrap', 'school_members', p_user::text);
end $$;
revoke all on function public.bootstrap_owner(uuid, uuid) from public;

-- ───────────── invitations ─────────────
-- create: returns the raw token ONCE; only its hash is stored
create or replace function public.create_invitation(
  p_school uuid, p_email text, p_role text, p_permissions jsonb default '{}'::jsonb,
  p_guardian uuid default null, p_staff uuid default null)
returns text language plpgsql security definer set search_path = public as $$
declare raw text := encode(gen_random_bytes(32), 'hex'); inv_id uuid;
begin
  if p_role = 'guardian' then
    perform require_perm(p_school, 'guardians.manage');
    p_permissions := '{}'::jsonb;           -- guardians never receive extra permissions
    p_staff := null;
  else
    -- staff invites carry permissions, so only the owner may issue them (no escalation)
    if not is_super_admin(p_school) then
      raise exception 'Only the Super Admin can invite staff' using errcode = '42501';
    end if;
    p_guardian := null;
  end if;
  if p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Invalid email';
  end if;
  insert into invitations(school_id, email, role_key, permissions, guardian_id, staff_id,
                          token_hash, invited_by)
  values (p_school, lower(trim(p_email)), p_role, coalesce(p_permissions,'{}'),
          p_guardian, p_staff, encode(digest(raw, 'sha256'), 'hex'), auth.uid())
  returning id into inv_id;
  perform write_audit(p_school, 'invitation.create', 'invitations', inv_id::text,
                      null, jsonb_build_object('email', lower(p_email), 'role', p_role));
  return raw;
end $$;

-- accept: caller must be signed in with the invited email
create or replace function public.accept_invitation(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare inv invitations; user_email text; mem_id uuid; k text; v jsonb;
begin
  select * into inv from invitations
   where token_hash = encode(digest(p_token, 'sha256'), 'hex')
   for update;
  if not found or inv.revoked_at is not null or inv.accepted_at is not null
     or inv.expires_at < now() then
    raise exception 'Invitation is invalid or expired' using errcode = '42501';
  end if;
  select lower(email) into user_email from auth.users where id = auth.uid();
  if user_email is distinct from inv.email then
    raise exception 'This invitation was sent to a different email address' using errcode = '42501';
  end if;

  insert into school_members(school_id, user_id, role_key, created_by)
  values (inv.school_id, auth.uid(), inv.role_key, inv.invited_by)
  on conflict (school_id, user_id) do update set role_key = excluded.role_key, status = 'active'
  returning id into mem_id;

  for k, v in select * from jsonb_each(inv.permissions) loop
    if exists (select 1 from permissions where key = k) then
      insert into member_permission_overrides(member_id, permission_key, granted)
      values (mem_id, k, v::text::boolean)
      on conflict (member_id, permission_key) do update set granted = excluded.granted;
    end if;
  end loop;

  if inv.guardian_id is not null then
    execute 'update guardians set profile_id = $1 where id = $2 and school_id = $3'
      using auth.uid(), inv.guardian_id, inv.school_id;
  end if;
  if inv.staff_id is not null then
    execute 'update staff set profile_id = $1 where id = $2 and school_id = $3'
      using auth.uid(), inv.staff_id, inv.school_id;
  end if;

  update invitations set accepted_at = now(), accepted_by = auth.uid() where id = inv.id;
  insert into audit_logs(school_id, actor_id, action, table_name, record_id)
  values (inv.school_id, auth.uid(), 'invitation.accept', 'invitations', inv.id::text);
  return inv.school_id;
end $$;

-- ───────────── seed roles & permissions ─────────────
insert into public.roles(key, name_en, name_bn, is_staff) values
  ('super_admin','Super Admin','সুপার অ্যাডমিন', true),
  ('admin','Administrator','প্রশাসক', true),
  ('accountant','Accountant / Cashier','হিসাবরক্ষক / ক্যাশিয়ার', true),
  ('teacher','Teacher','শিক্ষক', true),
  ('guardian','Guardian','অভিভাবক', false);

insert into public.permissions(key, module, description) values
  ('students.view','students','View student records'),
  ('students.create','students','Register students'),
  ('students.edit','students','Edit student details'),
  ('students.archive','students','Archive / withdraw / promote students'),
  ('guardians.manage','guardians','Create guardians and link them to students'),
  ('teachers.manage','teachers','Manage teacher records and assignments'),
  ('academics.manage','academics','Manage years, classes, sections, subjects, timetable'),
  ('attendance.view','attendance','View attendance'),
  ('attendance.create','attendance','Take attendance for any section'),
  ('attendance.correct','attendance','Correct past attendance'),
  ('homework.manage','homework','Manage homework for any section'),
  ('exams.manage','exams','Create exams and grading'),
  ('marks.enter','exams','Enter marks for any section'),
  ('results.publish','exams','Approve and publish results'),
  ('fees.view','fees','View fees, invoices and payments'),
  ('fees.configure','fees','Configure fee categories and structures'),
  ('fees.invoice','fees','Generate invoices'),
  ('fees.collect','fees','Collect payments and issue receipts'),
  ('fees.adjust','fees','Apply discounts and waivers'),
  ('fees.reverse','fees','Reverse confirmed payments'),
  ('fees.refund','fees','Record refunds'),
  ('expenses.view','expenses','View expenses'),
  ('expenses.create','expenses','Record expenses'),
  ('expenses.approve','expenses','Approve or reject expenses'),
  ('reports.view','reports','View reports and dashboards'),
  ('reports.export','reports','Export reports'),
  ('notices.manage','notices','Publish school-wide notices'),
  ('staff.manage','staff','Invite staff and change permissions'),
  ('settings.manage','settings','Change school settings and branding'),
  ('audit.view','audit','View audit log');

insert into public.role_permissions(role_key, permission_key)
select 'admin', key from public.permissions where key in (
  'students.view','students.create','students.edit','students.archive','guardians.manage',
  'teachers.manage','academics.manage','attendance.view','attendance.create','attendance.correct',
  'homework.manage','exams.manage','results.publish','fees.view','fees.collect',
  'reports.view','notices.manage','expenses.view')
union all
select 'accountant', key from public.permissions where key in (
  'students.view','fees.view','fees.collect','fees.invoice','expenses.view','expenses.create','reports.view');
-- Teachers get no school-wide permissions by default: RLS gives them access only to the
-- sections listed in teacher_assignments. The owner can grant extra permissions per teacher.
