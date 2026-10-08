-- 0003_finance.sql — fees, invoices, payments, reversals, refunds, expenses, reports
-- ALL money columns are bigint POISHA (৳1 = 100 poisha). Never floating point.

alter table public.schools
  add column late_fee_enabled    boolean not null default false,
  add column late_fee_amount     bigint  not null default 0 check (late_fee_amount >= 0),
  add column late_fee_grace_days int     not null default 0 check (late_fee_grace_days >= 0),
  add column default_due_day     int     not null default 10 check (default_due_day between 1 and 28);

-- ───────────── configuration ─────────────
create table public.fee_categories (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  name_en    text not null,
  name_bn    text not null,
  frequency  text not null check (frequency in ('monthly','one_time','annual')),
  is_active  boolean not null default true,
  sort_order int not null default 0,
  unique (school_id, name_en)
);

-- price list: per class (or all classes when class_id is null) per academic year
create table public.fee_structures (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  fee_category_id  uuid not null references public.fee_categories(id) on delete restrict,
  class_id         uuid references public.classes(id) on delete cascade,
  amount           bigint not null check (amount >= 0),
  due_day          int check (due_day between 1 and 28)
);
create unique index fee_structure_unique on public.fee_structures
  (academic_year_id, fee_category_id, coalesce(class_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- per-student standing discount / scholarship (applied when invoices are generated)
create table public.student_fee_discounts (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools(id) on delete cascade,
  student_id       uuid not null references public.students(id) on delete cascade,
  fee_category_id  uuid not null references public.fee_categories(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  kind             text not null check (kind in ('discount','scholarship','waiver')),
  percent          numeric(5,2) check (percent > 0 and percent <= 100),
  fixed_amount     bigint check (fixed_amount > 0),
  reason           text not null,
  approved_by      uuid references auth.users(id),
  created_at       timestamptz not null default now(),
  check ((percent is null) <> (fixed_amount is null)),
  unique (student_id, fee_category_id, academic_year_id)
);

-- ───────────── billing ─────────────
-- One row per charge to a student. billing_period = first day of the month for monthly fees.
create table public.invoice_items (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools(id) on delete cascade,
  student_id       uuid not null references public.students(id) on delete restrict,
  academic_year_id uuid references public.academic_years(id) on delete restrict,
  fee_category_id  uuid not null references public.fee_categories(id) on delete restrict,
  billing_period   date,
  description      text,
  amount           bigint not null check (amount > 0),
  due_on           date not null,
  status           text not null default 'active' check (status in ('active','cancelled')),
  cancel_reason    text,
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now()
);
-- prevents billing the same monthly fee twice
create unique index invoice_item_no_double_bill on public.invoice_items
  (student_id, fee_category_id, billing_period)
  where status = 'active' and billing_period is not null;
create index on public.invoice_items(school_id, due_on);
create index on public.invoice_items(student_id);

-- discounts / waivers / scholarships applied to a specific charge
create table public.invoice_adjustments (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  item_id     uuid not null references public.invoice_items(id) on delete restrict,
  kind        text not null check (kind in ('discount','waiver','scholarship')),
  amount      bigint not null check (amount > 0),
  reason      text not null,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);
create index on public.invoice_adjustments(item_id);

-- ───────────── payments ─────────────
create table public.payments (
  id                  uuid primary key default gen_random_uuid(),
  school_id           uuid not null references public.schools(id) on delete cascade,
  student_id          uuid not null references public.students(id) on delete restrict,
  receipt_no          text not null,
  amount              bigint not null check (amount > 0),
  method              text not null check (method in ('cash','bank','bkash','nagad','rocket','other')),
  reference           text,
  -- manual mobile-wallet / bank references are NOT independently verified
  verification_status text not null check (verification_status in ('not_applicable','unverified','verified')),
  paid_on             date not null,
  paid_at             timestamptz not null default now(),
  note                text,
  collected_by        uuid not null references auth.users(id),
  idempotency_key     text not null,
  status              text not null default 'confirmed' check (status in ('confirmed','reversed')),
  created_at          timestamptz not null default now(),
  unique (school_id, receipt_no),
  unique (school_id, idempotency_key),
  check (method = 'cash' or reference is not null and length(trim(reference)) > 0)
);
create index on public.payments(school_id, paid_on);
create index on public.payments(student_id, paid_on desc);

create table public.payment_allocations (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  payment_id uuid not null references public.payments(id) on delete restrict,
  item_id    uuid not null references public.invoice_items(id) on delete restrict,
  amount     bigint not null check (amount > 0),
  unique (payment_id, item_id)
);
create index on public.payment_allocations(item_id);

create table public.payment_reversals (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  payment_id  uuid not null unique references public.payments(id) on delete restrict,
  reason      text not null check (length(trim(reason)) >= 5),
  reversed_by uuid not null references auth.users(id),
  reversed_at timestamptz not null default now()
);

-- money returned to a guardian out of the student's unused credit (advance)
create table public.refunds (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  student_id  uuid not null references public.students(id) on delete restrict,
  amount      bigint not null check (amount > 0),
  method      text not null check (method in ('cash','bank','bkash','nagad','rocket','other')),
  reference   text,
  reason      text not null,
  refunded_on date not null,
  refunded_by uuid not null references auth.users(id),
  created_at  timestamptz not null default now()
);

-- ───────────── immutability ─────────────
create or replace function public.guard_payments() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Payments cannot be deleted; reverse them instead' using errcode = '42501';
  end if;
  if coalesce(current_setting('app.payment_reversal', true), '') = 'on'
     and old.status = 'confirmed' and new.status = 'reversed'
     and (to_jsonb(new) - 'status') = (to_jsonb(old) - 'status') then
    return new;
  end if;
  raise exception 'Confirmed payments cannot be modified' using errcode = '42501';
end $$;
create trigger payments_guard before update or delete on public.payments
  for each row execute function public.guard_payments();

create trigger allocations_immutable before update or delete on public.payment_allocations
  for each row execute function public.block_mutation();
create trigger reversals_immutable before update or delete on public.payment_reversals
  for each row execute function public.block_mutation();
create trigger refunds_immutable before update or delete on public.refunds
  for each row execute function public.block_mutation();
create trigger adjustments_immutable before update or delete on public.invoice_adjustments
  for each row execute function public.block_mutation();

-- invoice items: amount/student can never change; only cancellation, and only if unpaid
create or replace function public.guard_invoice_items() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Charges cannot be deleted; cancel them instead' using errcode = '42501';
  end if;
  if new.amount <> old.amount or new.student_id <> old.student_id
     or new.fee_category_id <> old.fee_category_id or new.school_id <> old.school_id then
    raise exception 'Charge amounts cannot be edited; cancel and re-issue' using errcode = '42501';
  end if;
  if old.status = 'cancelled' and new.status <> 'cancelled' then
    raise exception 'Cancelled charges cannot be re-activated' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger invoice_items_guard before update or delete on public.invoice_items
  for each row execute function public.guard_invoice_items();

-- ───────────── balances (single definition used everywhere) ─────────────
create or replace view public.invoice_item_balances with (security_invoker = true) as
select i.id as item_id, i.school_id, i.student_id, i.fee_category_id, i.academic_year_id,
       i.billing_period, i.due_on, i.amount, i.status,
       coalesce(adj.total, 0)                                     as adjusted,
       coalesce(pa.total, 0)                                      as paid,
       case when i.status = 'cancelled' then 0
            else i.amount - coalesce(adj.total,0) - coalesce(pa.total,0) end as outstanding
from public.invoice_items i
left join lateral (select sum(a.amount) total from public.invoice_adjustments a where a.item_id = i.id) adj on true
left join lateral (select sum(al.amount) total from public.payment_allocations al
                   join public.payments p on p.id = al.payment_id and p.status = 'confirmed'
                   where al.item_id = i.id) pa on true;

-- unallocated money a student has paid in advance
create or replace function public.student_credit(p_student uuid) returns bigint
language sql stable security definer set search_path = public as $$
  select coalesce((select sum(amount) from payments where student_id = p_student and status = 'confirmed'),0)
       - coalesce((select sum(al.amount) from payment_allocations al join payments p on p.id = al.payment_id
                   where p.student_id = p_student and p.status = 'confirmed'),0)
       - coalesce((select sum(amount) from refunds where student_id = p_student),0)
$$;

create or replace function public.local_today(p_school uuid) returns date
language sql stable security definer set search_path = public as $$
  select (now() at time zone timezone)::date from schools where id = p_school
$$;

-- ───────────── post_payment: atomic + idempotent ─────────────
-- p_allocations: [{"item_id": "...", "amount": 150000}, ...]  (poisha)
-- Allocated total may be less than p_amount — the remainder becomes advance credit.
create or replace function public.post_payment(
  p_student uuid, p_amount bigint, p_method text, p_reference text,
  p_allocations jsonb, p_idempotency_key text, p_note text default null)
returns public.payments
language plpgsql security definer set search_path = public as $$
declare
  sch uuid; existing payments; pay payments; a jsonb; it invoice_item_balances;
  alloc_total bigint := 0; amt bigint; today date; prefix text; rno text;
begin
  select school_id into sch from students where id = p_student;
  if sch is null then raise exception 'Unknown student'; end if;
  perform require_perm(sch, 'fees.collect');

  if p_idempotency_key is null or length(p_idempotency_key) < 8 then
    raise exception 'Missing idempotency key';
  end if;

  -- replay of an already-saved request → return the original, never post twice
  select * into existing from payments where school_id = sch and idempotency_key = p_idempotency_key;
  if found then
    if existing.student_id <> p_student or existing.amount <> p_amount then
      raise exception 'Idempotency key reused for a different payment' using errcode = '23505';
    end if;
    return existing;
  end if;

  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be positive'; end if;
  if p_amount > 100000000 then raise exception 'Amount is unusually large; check the figure'; end if; -- ৳10 lakh
  if p_method not in ('cash','bank','bkash','nagad','rocket','other') then raise exception 'Invalid method'; end if;
  if p_method <> 'cash' and coalesce(trim(p_reference),'') = '' then
    raise exception 'A transaction reference is required for % payments', p_method;
  end if;

  -- serialize payments per student so concurrent cashiers cannot over-allocate
  perform 1 from students where id = p_student for update;

  today := local_today(sch);
  select receipt_prefix into prefix from schools where id = sch;
  rno := prefix || '-' || to_char(today,'YYYY') || '-' ||
         lpad(next_counter(sch, 'receipt-' || to_char(today,'YYYY'))::text, 6, '0');

  begin
    insert into payments(school_id, student_id, receipt_no, amount, method, reference,
                         verification_status, paid_on, note, collected_by, idempotency_key)
    values (sch, p_student, rno, p_amount, p_method, nullif(trim(p_reference),''),
            case when p_method = 'cash' then 'not_applicable' else 'unverified' end,
            today, p_note, auth.uid(), p_idempotency_key)
    returning * into pay;
  exception when unique_violation then
    -- a concurrent identical request won the race
    select * into existing from payments where school_id = sch and idempotency_key = p_idempotency_key;
    if found and existing.student_id = p_student and existing.amount = p_amount then
      return existing;
    end if;
    raise;
  end;

  for a in select * from jsonb_array_elements(coalesce(p_allocations, '[]'::jsonb)) loop
    amt := (a->>'amount')::bigint;
    if amt is null or amt <= 0 then raise exception 'Allocation amounts must be positive'; end if;
    perform 1 from invoice_items where id = (a->>'item_id')::uuid for update;
    select * into it from invoice_item_balances where item_id = (a->>'item_id')::uuid;
    if not found or it.student_id <> p_student then
      raise exception 'Charge does not belong to this student';
    end if;
    if it.status <> 'active' then raise exception 'Charge has been cancelled'; end if;
    if amt > it.outstanding then
      raise exception 'Allocation (%) exceeds outstanding (%) for a charge', amt, it.outstanding;
    end if;
    insert into payment_allocations(school_id, payment_id, item_id, amount)
    values (sch, pay.id, it.item_id, amt);
    alloc_total := alloc_total + amt;
  end loop;

  if alloc_total > p_amount then
    raise exception 'Allocated total (%) exceeds payment amount (%)', alloc_total, p_amount;
  end if;

  perform write_audit(sch, 'payment.create', 'payments', pay.id::text, null,
    jsonb_build_object('receipt_no', pay.receipt_no, 'amount', pay.amount, 'method', pay.method,
                       'allocated', alloc_total, 'credit', p_amount - alloc_total));
  return pay;
end $$;

-- apply a student's existing advance credit to outstanding charges
create or replace function public.apply_credit(p_student uuid, p_item uuid, p_amount bigint)
returns void language plpgsql security definer set search_path = public as $$
declare sch uuid; credit bigint; it invoice_item_balances; src record; remaining bigint := p_amount; take bigint;
begin
  select school_id into sch from students where id = p_student;
  perform require_perm(sch, 'fees.collect');
  perform 1 from students where id = p_student for update;
  perform 1 from invoice_items where id = p_item for update;
  select * into it from invoice_item_balances where item_id = p_item;
  if it.student_id is distinct from p_student then raise exception 'Charge does not belong to this student'; end if;
  credit := student_credit(p_student);
  if p_amount <= 0 or p_amount > credit or p_amount > it.outstanding then
    raise exception 'Amount exceeds available credit or outstanding';
  end if;
  -- draw from the oldest payments with unallocated money
  for src in
    select p.id, p.amount - coalesce(sum(al.amount),0) as free
    from payments p left join payment_allocations al on al.payment_id = p.id
    where p.student_id = p_student and p.status = 'confirmed'
    group by p.id order by p.paid_at
  loop
    exit when remaining = 0;
    continue when src.free <= 0;
    take := least(src.free, remaining);
    insert into payment_allocations(school_id, payment_id, item_id, amount)
    values (sch, src.id, p_item, take)
    on conflict (payment_id, item_id) do nothing;
    if not found then raise exception 'Credit from this receipt is already applied to this charge'; end if;
    remaining := remaining - take;
  end loop;
  perform write_audit(sch, 'credit.apply', 'invoice_items', p_item::text, null,
                      jsonb_build_object('amount', p_amount));
end $$;

-- ───────────── reversal (never delete) ─────────────
create or replace function public.reverse_payment(p_payment uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare pay payments;
begin
  select * into pay from payments where id = p_payment for update;
  if not found then raise exception 'Unknown payment'; end if;
  perform require_perm(pay.school_id, 'fees.reverse');
  if pay.status = 'reversed' then raise exception 'Payment already reversed'; end if;
  if coalesce(length(trim(p_reason)),0) < 5 then raise exception 'A reason is required'; end if;

  perform set_config('app.payment_reversal', 'on', true);
  update payments set status = 'reversed' where id = p_payment;
  perform set_config('app.payment_reversal', 'off', true);

  insert into payment_reversals(school_id, payment_id, reason, reversed_by)
  values (pay.school_id, p_payment, p_reason, auth.uid());

  if student_credit(pay.student_id) < 0 then
    raise exception 'Cannot reverse: money from this receipt has already been refunded';
  end if;

  perform write_audit(pay.school_id, 'payment.reverse', 'payments', p_payment::text,
    jsonb_build_object('status','confirmed','amount',pay.amount,'receipt_no',pay.receipt_no),
    jsonb_build_object('status','reversed'), p_reason);
end $$;

create or replace function public.record_refund(
  p_student uuid, p_amount bigint, p_method text, p_reference text, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare sch uuid; rid uuid;
begin
  select school_id into sch from students where id = p_student;
  perform require_perm(sch, 'fees.refund');
  perform 1 from students where id = p_student for update;
  if p_amount <= 0 or p_amount > student_credit(p_student) then
    raise exception 'Refund exceeds the student''s unused credit';
  end if;
  insert into refunds(school_id, student_id, amount, method, reference, reason, refunded_on, refunded_by)
  values (sch, p_student, p_amount, p_method, p_reference, p_reason, local_today(sch), auth.uid())
  returning id into rid;
  perform write_audit(sch, 'refund.create', 'refunds', rid::text, null,
                      jsonb_build_object('amount', p_amount), p_reason);
  return rid;
end $$;

-- ───────────── charges ─────────────
create or replace function public.add_adjustment(p_item uuid, p_kind text, p_amount bigint, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare it invoice_item_balances;
begin
  perform 1 from invoice_items where id = p_item for update;
  select * into it from invoice_item_balances where item_id = p_item;
  if not found then raise exception 'Unknown charge'; end if;
  perform require_perm(it.school_id, 'fees.adjust');
  if p_amount <= 0 or p_amount > it.outstanding then
    raise exception 'Adjustment exceeds outstanding amount';
  end if;
  insert into invoice_adjustments(school_id, item_id, kind, amount, reason, created_by)
  values (it.school_id, p_item, p_kind, p_amount, p_reason, auth.uid());
  perform write_audit(it.school_id, 'fee.adjust', 'invoice_items', p_item::text, null,
                      jsonb_build_object('kind', p_kind, 'amount', p_amount), p_reason);
end $$;

create or replace function public.cancel_charge(p_item uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare it invoice_item_balances;
begin
  perform 1 from invoice_items where id = p_item for update;
  select * into it from invoice_item_balances where item_id = p_item;
  perform require_perm(it.school_id, 'fees.adjust');
  if it.paid > 0 then raise exception 'A charge with payments cannot be cancelled; reverse payments first'; end if;
  update invoice_items set status = 'cancelled', cancel_reason = p_reason where id = p_item;
  perform write_audit(it.school_id, 'fee.cancel', 'invoice_items', p_item::text, null, null, p_reason);
end $$;

-- one-off charge (admission fee, books, etc.)
create or replace function public.add_charge(
  p_student uuid, p_category uuid, p_amount bigint, p_due date,
  p_period date default null, p_description text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare sch uuid; iid uuid; yr uuid;
begin
  select school_id into sch from students where id = p_student;
  perform require_perm(sch, 'fees.invoice');
  if not exists (select 1 from fee_categories where id = p_category and school_id = sch) then
    raise exception 'Unknown fee category';
  end if;
  select id into yr from academic_years where school_id = sch and is_current;
  insert into invoice_items(school_id, student_id, academic_year_id, fee_category_id, billing_period,
                            description, amount, due_on, created_by)
  values (sch, p_student, yr, p_category, date_trunc('month', p_period)::date, p_description,
          p_amount, p_due, auth.uid())
  returning id into iid;
  perform write_audit(sch, 'fee.charge', 'invoice_items', iid::text, null,
                      jsonb_build_object('amount', p_amount));
  return iid;
end $$;

-- monthly billing run: idempotent (unique index blocks duplicates), applies standing discounts
create or replace function public.generate_monthly_charges(p_school uuid, p_month date)
returns int language plpgsql security definer set search_path = public as $$
declare yr academic_years; m date := date_trunc('month', p_month)::date; n int := 0; r record;
        iid uuid; disc bigint;
begin
  perform require_perm(p_school, 'fees.invoice');
  select * into yr from academic_years where school_id = p_school and is_current;
  if not found then raise exception 'Set a current academic year first'; end if;
  if m < date_trunc('month', yr.starts_on) or m > yr.ends_on then
    raise exception 'Month is outside the current academic year';
  end if;

  for r in
    select e.student_id, fs.fee_category_id, fs.amount,
           make_date(extract(year from m)::int, extract(month from m)::int,
                     coalesce(fs.due_day, s.default_due_day)) as due
    from enrollments e
    join sections sec on sec.id = e.section_id
    join students st on st.id = e.student_id and st.status = 'active'
    join schools s on s.id = p_school
    join fee_structures fs on fs.academic_year_id = yr.id
         and (fs.class_id = sec.class_id or (fs.class_id is null and not exists (
              select 1 from fee_structures f2 where f2.academic_year_id = yr.id
                and f2.fee_category_id = fs.fee_category_id and f2.class_id = sec.class_id)))
    join fee_categories fc on fc.id = fs.fee_category_id and fc.frequency = 'monthly' and fc.is_active
    where e.school_id = p_school and e.academic_year_id = yr.id and e.status = 'active' and fs.amount > 0
  loop
    insert into invoice_items(school_id, student_id, academic_year_id, fee_category_id, billing_period,
                              amount, due_on, created_by)
    values (p_school, r.student_id, yr.id, r.fee_category_id, m, r.amount, r.due, auth.uid())
    on conflict do nothing
    returning id into iid;
    if iid is not null then
      n := n + 1;
      select least(r.amount, coalesce(d.fixed_amount, round(r.amount * d.percent / 100)::bigint))
        into disc from student_fee_discounts d
        where d.student_id = r.student_id and d.fee_category_id = r.fee_category_id
          and d.academic_year_id = yr.id;
      if disc is not null and disc > 0 then
        insert into invoice_adjustments(school_id, item_id, kind, amount, reason, created_by)
        select p_school, iid, d.kind, disc, d.reason, auth.uid()
        from student_fee_discounts d
        where d.student_id = r.student_id and d.fee_category_id = r.fee_category_id
          and d.academic_year_id = yr.id;
      end if;
      iid := null; disc := null;
    end if;
  end loop;
  perform write_audit(p_school, 'fee.generate_monthly', 'invoice_items', to_char(m,'YYYY-MM'),
                      null, jsonb_build_object('created', n));
  return n;
end $$;

-- ───────────── expenses ─────────────
create table public.expense_categories (
  id        uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name_en   text not null,
  name_bn   text not null,
  is_active boolean not null default true,
  unique (school_id, name_en)
);

create table public.expenses (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references public.schools(id) on delete cascade,
  category_id     uuid not null references public.expense_categories(id) on delete restrict,
  amount          bigint not null check (amount > 0),
  description     text not null,
  spent_on        date not null,
  method          text not null check (method in ('cash','bank','bkash','nagad','rocket','other')),
  vendor          text,
  receipt_file_id uuid references public.uploaded_files(id) on delete set null,
  status          text not null default 'pending' check (status in ('pending','approved','rejected')),
  decision_note   text,
  created_by      uuid not null references auth.users(id),
  decided_by      uuid references auth.users(id),
  decided_at      timestamptz,
  idempotency_key text,
  created_at      timestamptz not null default now(),
  unique (school_id, idempotency_key)
);
create index on public.expenses(school_id, spent_on);

create or replace function public.guard_expenses() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'pending' then return old; end if;
    raise exception 'Decided expenses cannot be deleted' using errcode = '42501';
  end if;
  if old.status <> 'pending' then
    raise exception 'Approved or rejected expenses cannot be changed' using errcode = '42501';
  end if;
  if new.status <> 'pending' and coalesce(current_setting('app.expense_decision', true),'') <> 'on' then
    raise exception 'Use the approval action to approve or reject' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger expenses_guard before update or delete on public.expenses
  for each row execute function public.guard_expenses();

create or replace function public.decide_expense(p_expense uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare ex expenses;
begin
  select * into ex from expenses where id = p_expense for update;
  if not found then raise exception 'Unknown expense'; end if;
  perform require_perm(ex.school_id, 'expenses.approve');
  if ex.status <> 'pending' then raise exception 'Expense already decided'; end if;
  perform set_config('app.expense_decision', 'on', true);
  update expenses set status = case when p_approve then 'approved' else 'rejected' end,
         decision_note = p_note, decided_by = auth.uid(), decided_at = now()
   where id = p_expense;
  perform set_config('app.expense_decision', 'off', true);
  perform write_audit(ex.school_id, case when p_approve then 'expense.approve' else 'expense.reject' end,
                      'expenses', p_expense::text, null, jsonb_build_object('amount', ex.amount), p_note);
end $$;

-- ───────────── reporting (aggregated in SQL, permission-checked) ─────────────
create or replace function public.finance_summary(p_school uuid, p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  perform require_perm(p_school, 'reports.view');
  select jsonb_build_object(
    'collected_gross', coalesce((select sum(amount) from payments
        where school_id = p_school and paid_on between p_from and p_to and status = 'confirmed'),0),
    'collected_by_method', coalesce((select jsonb_object_agg(method, total) from (
        select method, sum(amount) total from payments
        where school_id = p_school and paid_on between p_from and p_to and status = 'confirmed'
        group by method) x), '{}'::jsonb),
    'unverified_wallet_bank', coalesce((select sum(amount) from payments
        where school_id = p_school and paid_on between p_from and p_to and status = 'confirmed'
          and verification_status = 'unverified'),0),
    'reversed', coalesce((select sum(p.amount) from payments p join payment_reversals r on r.payment_id = p.id
        where p.school_id = p_school and (r.reversed_at at time zone 'Asia/Dhaka')::date between p_from and p_to),0),
    'refunds', coalesce((select sum(amount) from refunds
        where school_id = p_school and refunded_on between p_from and p_to),0),
    'billed', coalesce((select sum(amount) from invoice_items
        where school_id = p_school and status = 'active' and due_on between p_from and p_to),0),
    'discounts', coalesce((select sum(amount) from invoice_adjustments
        where school_id = p_school and (created_at at time zone 'Asia/Dhaka')::date between p_from and p_to),0),
    'expenses_approved', coalesce((select sum(amount) from expenses
        where school_id = p_school and status = 'approved' and spent_on between p_from and p_to),0),
    'expenses_pending', coalesce((select sum(amount) from expenses
        where school_id = p_school and status = 'pending' and spent_on between p_from and p_to),0),
    'outstanding_now', coalesce((select sum(outstanding) from invoice_item_balances
        where school_id = p_school and status = 'active'),0),
    'overdue_now', coalesce((select sum(outstanding) from invoice_item_balances
        where school_id = p_school and status = 'active' and due_on < local_today(p_school)),0),
    'collected_by_category', coalesce((select jsonb_agg(jsonb_build_object(
        'category_id', fc.id, 'name_en', fc.name_en, 'name_bn', fc.name_bn, 'amount', t.total)) from (
        select i.fee_category_id, sum(al.amount) total from payment_allocations al
        join payments p on p.id = al.payment_id and p.status = 'confirmed'
        join invoice_items i on i.id = al.item_id
        where p.school_id = p_school and p.paid_on between p_from and p_to
        group by i.fee_category_id) t join fee_categories fc on fc.id = t.fee_category_id), '[]'::jsonb)
  ) into r;
  -- net = collected − refunds; surplus = net − approved expenses
  r := r || jsonb_build_object(
    'net_collected', (r->>'collected_gross')::bigint - (r->>'refunds')::bigint,
    'surplus', (r->>'collected_gross')::bigint - (r->>'refunds')::bigint - (r->>'expenses_approved')::bigint);
  return r;
end $$;

create or replace function public.monthly_income_expense(p_school uuid, p_from date, p_to date)
returns table(month date, collected bigint, refunds bigint, expenses bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  perform require_perm(p_school, 'reports.view');
  return query
  select m::date,
    coalesce((select sum(amount) from payments where school_id = p_school and status = 'confirmed'
              and date_trunc('month', paid_on) = m),0)::bigint,
    coalesce((select sum(amount) from refunds where school_id = p_school
              and date_trunc('month', refunded_on) = m),0)::bigint,
    coalesce((select sum(amount) from expenses where school_id = p_school and status = 'approved'
              and date_trunc('month', spent_on) = m),0)::bigint
  from generate_series(date_trunc('month', p_from), date_trunc('month', p_to), interval '1 month') m;
end $$;

create or replace function public.dashboard_counts(p_school uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare today date := local_today(p_school); r jsonb;
begin
  if not is_staff(p_school) then raise exception 'Permission denied' using errcode = '42501'; end if;
  select jsonb_build_object(
    'students_total', (select count(*) from students where school_id = p_school),
    'students_active', (select count(*) from students where school_id = p_school and status = 'active'),
    'admissions_this_year', (select count(*) from students where school_id = p_school
        and date_trunc('year', admission_date) = date_trunc('year', today)),
    'teachers', (select count(distinct ta.staff_id) from teacher_assignments ta
        join academic_years y on y.id = ta.academic_year_id and y.is_current where ta.school_id = p_school),
    'staff', (select count(*) from staff where school_id = p_school and status = 'active'),
    'guardians', (select count(*) from guardians where school_id = p_school and status = 'active'),
    'present_today', (select count(*) from student_attendance where school_id = p_school
        and date = today and status in ('present','late')),
    'absent_today', (select count(*) from student_attendance where school_id = p_school
        and date = today and status = 'absent'),
    'marked_today', (select count(*) from student_attendance where school_id = p_school and date = today),
    'pending_expenses', (select count(*) from expenses where school_id = p_school and status = 'pending'),
    'today', today
  ) into r;
  return r;
end $$;
