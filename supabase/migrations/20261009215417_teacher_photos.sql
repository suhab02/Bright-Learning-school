-- Teacher/staff photos remain private; only school teacher managers can use them.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('teacher-photos','teacher-photos',false,2097152,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;

create policy teacher_photos_read on storage.objects for select to authenticated
using (bucket_id='teacher-photos' and public.has_perm(public.storage_school(name),'teachers.manage'));
create policy teacher_photos_insert on storage.objects for insert to authenticated
with check (bucket_id='teacher-photos' and public.has_perm(public.storage_school(name),'teachers.manage')
  and name ~ ('^'||public.storage_school(name)::text||'/[0-9a-f-]{36}\.jpg$'));
create policy teacher_photos_delete on storage.objects for delete to authenticated
using (bucket_id='teacher-photos' and public.has_perm(public.storage_school(name),'teachers.manage'));

-- Invoker preserves the staff and storage RLS checks, including suspended memberships.
create or replace function public.set_staff_photo(p_staff uuid,p_path text) returns text
language plpgsql security invoker set search_path=public as $$
declare st public.staff; old_path text;
begin
  select * into st from public.staff where id=p_staff;
  if not found then raise exception 'not_found'; end if;
  if not public.has_perm(st.school_id,'teachers.manage') then
    raise exception 'Permission denied: teachers.manage' using errcode='42501';
  end if;
  select photo_path into old_path from public.staff where id=p_staff for update;
  if p_path is not null then
    if p_path !~ ('^'||st.school_id::text||'/[0-9a-f-]{36}\.jpg$') then
      raise exception 'invalid_photo_path' using errcode='22023';
    end if;
    if not exists(select 1 from storage.objects where bucket_id='teacher-photos' and name=p_path) then
      raise exception 'photo_not_uploaded' using errcode='22023';
    end if;
  end if;
  update public.staff set photo_path=p_path where id=p_staff;
  return old_path;
end $$;
revoke execute on function public.set_staff_photo(uuid,text) from public,anon;
grant execute on function public.set_staff_photo(uuid,text) to authenticated;
