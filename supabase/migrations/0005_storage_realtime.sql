-- 0005_storage_realtime.sql — private storage buckets + realtime publication
-- Object paths always start with the school id:  <school_id>/<category>/<file>

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('branding',  'branding',  true,  2097152,  array['image/png','image/jpeg','image/webp','image/svg+xml','image/x-icon']),
  ('documents', 'documents', false, 10485760, array['application/pdf','image/png','image/jpeg','image/webp',
     'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
     'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do nothing;

create or replace function public.storage_school(p_name text) returns uuid
language sql immutable as $$
  select case when split_part(p_name, '/', 1) ~ '^[0-9a-f-]{36}$'
              then split_part(p_name, '/', 1)::uuid end
$$;

-- branding (logo/favicon) is public to read; only settings.manage may write
create policy branding_write on storage.objects for insert to authenticated
  with check (bucket_id = 'branding' and has_perm(public.storage_school(name), 'settings.manage'));
create policy branding_update on storage.objects for update to authenticated
  using (bucket_id = 'branding' and has_perm(public.storage_school(name), 'settings.manage'));
create policy branding_delete on storage.objects for delete to authenticated
  using (bucket_id = 'branding' and has_perm(public.storage_school(name), 'settings.manage'));

-- documents: readable only when the matching uploaded_files row is readable (RLS on that table)
create policy documents_read on storage.objects for select to authenticated using (
  bucket_id = 'documents'
  and exists (select 1 from public.uploaded_files f where f.bucket = 'documents' and f.path = storage.objects.name));
create policy documents_write on storage.objects for insert to authenticated with check (
  bucket_id = 'documents' and public.is_staff(public.storage_school(name)));
create policy documents_delete on storage.objects for delete to authenticated using (
  bucket_id = 'documents' and owner = auth.uid());

-- Realtime: clients receive "changed" signals (RLS-filtered) and then re-fetch.
alter publication supabase_realtime add table
  public.students, public.student_attendance, public.payments, public.invoice_items,
  public.notices, public.notifications, public.expenses, public.homework, public.schools;
