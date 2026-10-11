-- Allow the optional compressed teacher signature within the existing notice metadata.
alter table public.notices drop constraint notice_template_object;
alter table public.notices add constraint notice_template_object check (
  jsonb_typeof(template_details) = 'object' and octet_length(template_details::text) <= 65000
);
