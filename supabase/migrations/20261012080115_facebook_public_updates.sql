alter table public.schools add column if not exists facebook_page_url text;
alter table public.schools add constraint school_facebook_page_url check (facebook_page_url is null or (length(facebook_page_url)<=500 and facebook_page_url ~ '^https://www[.]facebook[.]com/[^[:space:]]+$'));
