-- 0008_fees.sql — fee rates, per-student balances, collection with server-side allocation

-- Per-student totals (poisha). security_invoker: guardians see only their children, etc.
create or replace view public.student_fee_balances with (security_invoker = true) as
select b.student_id, b.school_id,
       sum(b.amount) filter (where b.status = 'active')                 as billed,
       sum(b.adjusted) filter (where b.status = 'active')               as discounts,
       sum(b.paid) filter (where b.status = 'active')                   as paid,
       sum(b.outstanding) filter (where b.status = 'active')            as outstanding,
       coalesce(sum(b.outstanding) filter (where b.status = 'active'
                and b.due_on < public.local_today(b.school_id)), 0)     as overdue,
       min(b.due_on) filter (where b.status = 'active' and b.outstanding > 0) as oldest_due
from public.invoice_item_balances b
group by b.student_id, b.school_id;
grant select on public.student_fee_balances to authenticated;

-- Replace the current year's rates for one fee category, class by class.
-- p_rates: [{"class_id": "...", "amount": 150000}, ...]  amount null/0 = no charge for that class
create or replace function public.set_fee_rates(p_category uuid, p_rates jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare cat fee_categories; yr uuid; r jsonb; n int := 0; amt bigint; before jsonb;
begin
  select * into cat from fee_categories where id = p_category;
  if not found then raise exception 'unknown_category'; end if;
  perform require_perm(cat.school_id, 'fees.configure');
  select id into yr from academic_years where school_id = cat.school_id and is_current;
  if yr is null then raise exception 'no_current_year' using errcode = '22023'; end if;

  select coalesce(jsonb_agg(jsonb_build_object('class_id', class_id, 'amount', amount)), '[]') into before
    from fee_structures where academic_year_id = yr and fee_category_id = p_category;

  for r in select * from jsonb_array_elements(coalesce(p_rates, '[]')) loop
    if not exists (select 1 from classes where id = (r->>'class_id')::uuid and school_id = cat.school_id) then
      raise exception 'unknown_class';
    end if;
    amt := nullif(r->>'amount', '')::bigint;
    if amt is not null and (amt < 0 or amt > 100000000) then raise exception 'invalid_amount' using errcode = '22023'; end if;
    delete from fee_structures
     where academic_year_id = yr and fee_category_id = p_category and class_id = (r->>'class_id')::uuid;
    if coalesce(amt, 0) > 0 then
      insert into fee_structures(school_id, academic_year_id, fee_category_id, class_id, amount)
      values (cat.school_id, yr, p_category, (r->>'class_id')::uuid, amt);
      n := n + 1;
    end if;
  end loop;
  -- already-issued charges are never touched: only future billing uses the new rates
  perform write_audit(cat.school_id, 'fee.rates', 'fee_structures', p_category::text, before, p_rates);
  return n;
end $$;

-- Collect a payment. The browser only says which charges and how much; the database
-- decides the split (oldest due first), re-reading balances under lock. Any amount
-- left over after the chosen charges becomes advance credit.
create or replace function public.collect_fee(
  p_student uuid, p_amount bigint, p_method text, p_reference text,
  p_item_ids uuid[], p_idempotency_key text, p_note text default null)
returns public.payments
language plpgsql security definer set search_path = public as $$
declare sch uuid; existing payments; left_ bigint := p_amount; allocs jsonb := '[]'; it record; take bigint;
begin
  select school_id into sch from students where id = p_student;
  if sch is null then raise exception 'Unknown student'; end if;
  perform require_perm(sch, 'fees.collect');
  -- a replayed request returns the original payment untouched
  select * into existing from payments where school_id = sch and idempotency_key = p_idempotency_key;
  if found then return post_payment(p_student, p_amount, p_method, p_reference, '[]', p_idempotency_key, p_note); end if;

  perform 1 from students where id = p_student for update;
  for it in
    select b.item_id, b.outstanding from invoice_item_balances b
    where b.student_id = p_student and b.status = 'active' and b.outstanding > 0
      and (p_item_ids is null or b.item_id = any(p_item_ids))
    order by b.due_on, b.billing_period nulls first, b.item_id
  loop
    exit when left_ <= 0;
    take := least(left_, it.outstanding);
    allocs := allocs || jsonb_build_array(jsonb_build_object('item_id', it.item_id, 'amount', take));
    left_ := left_ - take;
  end loop;
  return post_payment(p_student, p_amount, p_method, p_reference, allocs, p_idempotency_key, p_note);
end $$;

-- Use a student's advance credit on their oldest unpaid charges.
-- Draws from receipts with unallocated money (oldest first); a receipt already linked to a
-- charge is skipped for that charge, because receipt lines are never edited.
create or replace function public.use_advance_credit(p_student uuid) returns bigint
language plpgsql security definer set search_path = public as $$
declare sch uuid; used bigint := 0; it record; src record; need bigint; take bigint;
begin
  select school_id into sch from students where id = p_student;
  if sch is null then raise exception 'Unknown student'; end if;
  perform require_perm(sch, 'fees.collect');
  perform 1 from students where id = p_student for update;
  for it in
    select b.item_id, b.outstanding from invoice_item_balances b
    where b.student_id = p_student and b.status = 'active' and b.outstanding > 0
    order by b.due_on, b.item_id
  loop
    need := it.outstanding;
    for src in
      select p.id, p.amount - coalesce((select sum(al.amount) from payment_allocations al where al.payment_id = p.id), 0) as free
      from payments p
      where p.student_id = p_student and p.status = 'confirmed'
        and not exists (select 1 from payment_allocations x where x.payment_id = p.id and x.item_id = it.item_id)
      order by p.paid_at
    loop
      exit when need <= 0;
      continue when src.free <= 0;
      -- refunds come out of credit too: never allocate more than the student's real credit
      take := least(src.free, need, student_credit(p_student));
      exit when take <= 0;
      insert into payment_allocations(school_id, payment_id, item_id, amount) values (sch, src.id, it.item_id, take);
      need := need - take; used := used + take;
    end loop;
  end loop;
  if used > 0 then
    perform write_audit(sch, 'credit.apply', 'students', p_student::text, null, jsonb_build_object('amount', used));
  end if;
  return used;
end $$;

-- payment collector names for receipts (staff only; guardians see the receipt without it)
create or replace function public.staff_name(p_user uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(p.full_name, split_part(p.email, '@', 1)) from profiles p
  where p.id = p_user and exists (
    select 1 from school_members m where m.user_id = auth.uid() and m.status = 'active'
      and m.school_id in (select school_id from school_members where user_id = p_user))
$$;

revoke execute on function public.set_fee_rates(uuid, jsonb), public.collect_fee(uuid, bigint, text, text, uuid[], text, text),
  public.use_advance_credit(uuid), public.staff_name(uuid) from public, anon;
grant execute on function public.set_fee_rates(uuid, jsonb), public.collect_fee(uuid, bigint, text, text, uuid[], text, text),
  public.use_advance_credit(uuid), public.staff_name(uuid) to authenticated;

-- student_credit was callable by any signed-in user; restrict it to fee staff and the child's guardians
create or replace function public.student_credit(p_student uuid) returns bigint
language plpgsql stable security definer set search_path = public as $$
declare sch uuid;
begin
  select school_id into sch from students where id = p_student;
  if sch is null then return 0; end if;
  if not (has_perm(sch, 'fees.view') or has_perm(sch, 'fees.collect') or is_guardian_of(p_student)) then
    raise exception 'Permission denied: fees.view' using errcode = '42501';
  end if;
  return coalesce((select sum(amount) from payments where student_id = p_student and status = 'confirmed'),0)
       - coalesce((select sum(al.amount) from payment_allocations al join payments p on p.id = al.payment_id
                   where p.student_id = p_student and p.status = 'confirmed'),0)
       - coalesce((select sum(amount) from refunds where student_id = p_student),0);
end $$;
