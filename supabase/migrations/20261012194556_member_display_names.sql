alter table public.school_members add column display_name text;
alter table public.school_members add constraint school_members_display_name_check check (display_name is null or (char_length(display_name) between 1 and 120 and display_name = btrim(display_name)));
comment on column public.school_members.display_name is 'School-specific display name, edited by the Super Admin under existing member RLS.';
