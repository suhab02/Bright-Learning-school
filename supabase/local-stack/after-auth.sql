-- storage + realtime stand-ins (Storage API / Realtime servers are not run locally)
create schema if not exists storage;
create table if not exists storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table if not exists storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
do $$ begin if not exists (select from pg_publication where pubname='supabase_realtime') then create publication supabase_realtime; end if; end $$;
grant select on auth.users to service_role;
