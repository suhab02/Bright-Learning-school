-- 0009_student_photos.sql — private student photos
-- Path: <school_id>/<random>.jpg   (bucket is PRIVATE; the app shows photos via short-lived signed links)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('student-photos', 'student-photos', false, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- who may see a photo: staff who can view students, the child's teachers, the child's guardians
create or replace function public.can_see_student_photo(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select has_perm(storage_school(p_name), 'students.view')
      or exists (select 1 from students s where s.photo_path = p_name
                 and (teaches_student(s.id) or is_guardian_of(s.id)))
$$;

create policy student_photos_read on storage.objects for select to authenticated
  using (bucket_id = 'student-photos' and public.can_see_student_photo(name));
create policy student_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'student-photos'
    and (public.has_perm(public.storage_school(name), 'students.create')
      or public.has_perm(public.storage_school(name), 'students.edit')));
create policy student_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'student-photos' and public.has_perm(public.storage_school(name), 'students.edit'));

-- Link (or remove, with null) a student's photo. Returns the previous path so the app
-- can delete the old file. Whoever admitted a student may add the photo right after.
create or replace function public.set_student_photo(p_student uuid, p_path text) returns text
language plpgsql security definer set search_path = public as $$
declare st students;
begin
  select * into st from students where id = p_student for update;
  if not found then raise exception 'not_found'; end if;
  if not (has_perm(st.school_id, 'students.edit')
          or (has_perm(st.school_id, 'students.create') and st.created_by = auth.uid()
              and st.created_at > now() - interval '1 hour')) then
    raise exception 'Permission denied: students.edit' using errcode = '42501';
  end if;
  if p_path is not null and p_path !~ ('^' || st.school_id::text || '/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$') then
    raise exception 'invalid_photo_path' using errcode = '22023';
  end if;
  update students set photo_path = p_path where id = p_student;
  perform write_audit(st.school_id, 'student.photo', 'students', p_student::text,
    jsonb_build_object('photo_path', st.photo_path), jsonb_build_object('photo_path', p_path));
  return st.photo_path;
end $$;

revoke execute on function public.set_student_photo(uuid, text), public.can_see_student_photo(text) from public, anon;
grant execute on function public.set_student_photo(uuid, text), public.can_see_student_photo(text) to authenticated;
