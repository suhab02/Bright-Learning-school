revoke update on public.school_members from authenticated, anon, public;
grant update (display_name) on public.school_members to authenticated;
create policy members_name_write on public.school_members for update to authenticated using (public.is_super_admin(school_id)) with check (public.is_super_admin(school_id));
