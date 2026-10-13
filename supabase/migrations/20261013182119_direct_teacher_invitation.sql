create or replace function public.create_invitation(
  p_school uuid, p_email text, p_role text, p_permissions jsonb default '{}'::jsonb,
  p_guardian uuid default null, p_staff uuid default null)
returns text language plpgsql security definer set search_path = public, extensions as $$
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
  if p_email is null or btrim(p_email) !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
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
create or replace function public.invite_teacher(p_school uuid, p_email text, p_name text, p_staff uuid default null)
returns text language plpgsql security invoker set search_path = public, extensions as $$
declare teacher public.staff; matches integer; normalized_email text:=lower(btrim(p_email)); teacher_name text:=btrim(p_name);
begin
 if auth.uid() is null or not public.is_super_admin(p_school) then raise exception 'permission_denied' using errcode='42501'; end if;
 if teacher_name is null or char_length(teacher_name) not between 1 and 120 or normalized_email is null or normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then raise exception 'invalid_input'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_school::text||':'||normalized_email,0));
 if p_staff is not null then
  select * into teacher from public.staff where id=p_staff and school_id=p_school for update;
  if not found or lower(btrim(teacher.email)) is distinct from normalized_email then raise exception 'invalid_input'; end if;
 else
  select count(*) into matches from public.staff where school_id=p_school and lower(btrim(email))=normalized_email;
  if matches>1 then raise exception 'Duplicate teacher email. Open the intended teacher profile to invite.'; end if;
  select * into teacher from public.staff where school_id=p_school and lower(btrim(email))=normalized_email for update;
 end if;
 if teacher.id is not null then
  if teacher.status<>'active' then raise exception 'Activate the teacher profile before inviting.'; end if;
  if teacher.profile_id is not null and not exists(select 1 from public.profiles p where p.id=teacher.profile_id and lower(p.email)=normalized_email) then raise exception 'Teacher profile is already linked to another account'; end if;
 else
  insert into public.staff(school_id,staff_code,full_name_en,email,designation,status)
  values(p_school,'',teacher_name,normalized_email,'Teacher','active') returning * into teacher;
 end if;
 return public.create_invitation(p_school,normalized_email,'teacher','{}'::jsonb,null,teacher.id);
end $$;
revoke all on function public.invite_teacher(uuid,text,text,uuid) from public, anon;
grant execute on function public.invite_teacher(uuid,text,text,uuid) to authenticated;
