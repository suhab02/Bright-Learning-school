-- Save student and primary guardian together. Caller RLS and both permissions apply.
create or replace function public.update_student_with_guardian(p_id uuid,p jsonb)
returns void language plpgsql security invoker set search_path=public as $$
declare st public.students; gid uuid; ph text; nm text; rel text;
begin
  select * into st from public.students where id=p_id;
  if not found then raise exception 'not_found'; end if;
  perform public.require_perm(st.school_id,'students.edit');
  perform public.require_perm(st.school_id,'guardians.manage');
  nm:=nullif(trim(p->>'guardian_name'),'');
  ph:=public.normalize_bd_phone(p->>'guardian_phone');
  rel:=coalesce(nullif(p->>'guardian_relationship',''),'father');
  if rel not in ('father','mother','legal_guardian','other') then
    raise exception 'invalid_relationship' using errcode='22023';
  end if;
  -- Existing student logic retains its roll, class and audit protections.
  perform public.update_student(p_id,p);
  -- Empty guardian details do not delete or unlink an existing guardian.
  if nm is null and ph is null then return; end if;
  select guardian_id into gid from public.student_guardians
    where student_id=p_id and school_id=st.school_id
    order by is_primary desc,guardian_id limit 1 for update;
  if gid is not null then
    perform 1 from public.guardians where id=gid and school_id=st.school_id for update;
    update public.guardians set full_name=coalesce(nm,ph),phone=ph,
      email=nullif(lower(trim(p->>'guardian_email')),'')
      where id=gid and school_id=st.school_id;
  else
    -- Reuse a sibling's school guardian by normalized phone.
    if ph is not null then
      select id into gid from public.guardians where school_id=st.school_id and phone=ph
        order by id limit 1 for update;
    end if;
    if gid is null then
      insert into public.guardians(school_id,full_name,phone,email,address)
      values(st.school_id,coalesce(nm,ph),ph,nullif(lower(trim(p->>'guardian_email')),''),
        nullif(trim(p->>'address'),'')) returning id into gid;
    end if;
  end if;
  update public.student_guardians set is_primary=false
    where student_id=p_id and school_id=st.school_id and guardian_id<>gid;
  insert into public.student_guardians(student_id,guardian_id,school_id,relationship,is_primary)
    values(p_id,gid,st.school_id,rel,true)
    on conflict(student_id,guardian_id) do update
      set relationship=excluded.relationship,is_primary=true;
end $$;
revoke execute on function public.update_student_with_guardian(uuid,jsonb) from public,anon;
grant execute on function public.update_student_with_guardian(uuid,jsonb) to authenticated;

-- The existing protected audit trigger records contact changes without exposing its writer.
create trigger workflow_audit after insert or update or delete on public.guardians
for each row execute function public.audit_school_workflow();
