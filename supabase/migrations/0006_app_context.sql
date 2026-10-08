-- 0006_app_context.sql — one call that tells the app who the user is and what they may do

create or replace function public.my_context() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare m school_members; perms text[];
begin
  if auth.uid() is null then return null; end if;
  select * into m from school_members
   where user_id = auth.uid() and status = 'active'
   order by case role_key when 'super_admin' then 0 when 'admin' then 1 when 'accountant' then 2
                          when 'teacher' then 3 else 4 end
   limit 1;
  if not found then return jsonb_build_object('user_id', auth.uid(), 'member', null); end if;

  select coalesce(array_agg(p.key order by p.key), '{}') into perms
    from permissions p where has_perm(m.school_id, p.key);

  update profiles set last_login_at = now()
   where id = auth.uid() and (last_login_at is null or last_login_at < now() - interval '10 minutes');

  return jsonb_build_object(
    'user_id', auth.uid(),
    'school_id', m.school_id,
    'role', m.role_key,
    'permissions', to_jsonb(perms),
    'staff_id', (select id from staff where school_id = m.school_id and profile_id = auth.uid()),
    'guardian_id', (select id from guardians where school_id = m.school_id and profile_id = auth.uid()),
    'teaches_sections', (select coalesce(jsonb_agg(distinct ta.section_id), '[]') from teacher_assignments ta
        join staff s on s.id = ta.staff_id join academic_years y on y.id = ta.academic_year_id and y.is_current
        where s.profile_id = auth.uid() and s.school_id = m.school_id));
end $$;
-- my_context updates last_login_at, so it cannot be STABLE
alter function public.my_context() volatile;
grant execute on function public.my_context() to authenticated;

-- school id the bootstrap should attach the first owner to (single-school deployment)
create or replace function public.school_needs_owner() returns uuid
language sql stable security definer set search_path = public as $$
  select s.id from schools s
  where not exists (select 1 from school_members m where m.school_id = s.id and m.role_key = 'super_admin')
  order by s.created_at limit 1
$$;
revoke execute on function public.school_needs_owner() from public, anon, authenticated;
grant execute on function public.school_needs_owner() to service_role;

-- audit every change to school settings (only changed fields are stored)
create or replace function public.audit_school_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare b jsonb := '{}'; a jsonb := '{}'; k text;
begin
  for k in select key from jsonb_each(to_jsonb(new)) loop
    continue when k in ('updated_at');
    if to_jsonb(new)->k is distinct from to_jsonb(old)->k then
      b := b || jsonb_build_object(k, to_jsonb(old)->k);
      a := a || jsonb_build_object(k, to_jsonb(new)->k);
    end if;
  end loop;
  if a <> '{}'::jsonb then
    perform write_audit(new.id, 'settings.update', 'schools', new.id::text, b, a);
  end if;
  return new;
end $$;
create trigger schools_audit after update on public.schools
  for each row execute function public.audit_school_update();
