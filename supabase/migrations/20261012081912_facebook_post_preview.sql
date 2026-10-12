alter table public.schools add column if not exists facebook_post_preview jsonb;
alter table public.schools add constraint school_facebook_post_preview check (facebook_post_preview is null or (jsonb_typeof(facebook_post_preview)='object' and octet_length(facebook_post_preview::text)<=10000));
