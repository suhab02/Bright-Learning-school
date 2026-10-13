create table public.guardian_sms_outbox (
 id uuid primary key,
 school_id uuid not null references public.schools(id) on delete restrict,
 guardian_id uuid not null references public.guardians(id) on delete restrict,
 sender_id uuid not null references auth.users(id) on delete restrict,
 message text not null check(char_length(btrim(message)) between 1 and 210),
 status text not null default 'reserved' check(status in ('reserved','queued','failed','unknown')),
 provider_batch_id text check(provider_batch_id is null or char_length(provider_batch_id)<=100),
 created_at timestamptz not null default now()
);
create index guardian_sms_sender_rate_idx on public.guardian_sms_outbox(sender_id,guardian_id,created_at desc);
alter table public.guardian_sms_outbox enable row level security;
revoke all on public.guardian_sms_outbox from public,anon,authenticated;
grant select,insert on public.guardian_sms_outbox to authenticated;
grant update(status,provider_batch_id) on public.guardian_sms_outbox to authenticated;
create policy sms_read on public.guardian_sms_outbox for select to authenticated using (
 public.has_perm(school_id,'guardians.manage') and (sender_id=auth.uid() or public.is_super_admin(school_id))
);
create policy sms_reserve on public.guardian_sms_outbox for insert to authenticated with check (
 sender_id=auth.uid() and status='reserved' and provider_batch_id is null
 and created_at between now()-interval '5 seconds' and now()+interval '5 seconds'
 and public.has_perm(school_id,'guardians.manage')
 and exists(select 1 from public.guardians g where g.id=guardian_sms_outbox.guardian_id and g.school_id=guardian_sms_outbox.school_id)
);
create policy sms_update on public.guardian_sms_outbox for update to authenticated using (
 sender_id=auth.uid() and public.has_perm(school_id,'guardians.manage')
) with check (
 sender_id=auth.uid() and public.has_perm(school_id,'guardians.manage')
);

