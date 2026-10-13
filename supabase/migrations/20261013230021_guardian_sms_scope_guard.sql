alter policy sms_reserve on public.guardian_sms_outbox with check (
 sender_id=auth.uid() and status='reserved' and provider_batch_id is null
 and created_at between now()-interval '5 seconds' and now()+interval '5 seconds'
 and public.has_perm(school_id,'guardians.manage')
 and exists(select 1 from public.guardians g where g.id=guardian_sms_outbox.guardian_id and g.school_id=guardian_sms_outbox.school_id)
);
