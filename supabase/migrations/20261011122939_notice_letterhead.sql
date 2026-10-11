-- Notice letterhead metadata; existing notices keep their text and access policies.
alter table public.notices
  add column template_details jsonb not null default '{}'::jsonb
  constraint notice_template_object check (
    jsonb_typeof(template_details) = 'object'
    and octet_length(template_details::text) <= 10000
  );
