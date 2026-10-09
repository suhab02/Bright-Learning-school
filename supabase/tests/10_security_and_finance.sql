-- 10_security_and_finance.sql — acceptance tests for RLS isolation and money integrity.
-- Each DO block switches to the `authenticated` role with a given user id, like a real
-- Supabase request. Any failed assertion aborts the run (ON_ERROR_STOP).

create schema test;
create table test.ids (k text primary key, v uuid);
grant usage on schema test to authenticated;
grant select, insert on test.ids to authenticated;

create function test.id(p text) returns uuid language sql stable as $$ select v from test.ids where k = p $$;
create function test.login(p text) returns void language plpgsql as $t$
begin
  perform set_config('request.jwt.claim.sub', test.id(p)::text, true);
  execute 'set local role authenticated';
end $t$;
grant execute on all functions in schema test to authenticated;

create function test.expect_error(p_sql text, p_like text) returns void language plpgsql as $t$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm not ilike '%' || p_like || '%' then
      raise exception 'Expected error like "%" but got "%"', p_like, sqlerrm;
    end if;
    return;
  end;
  raise exception 'Expected an error (%) but the statement succeeded: %', p_like, p_sql;
end $t$;
grant execute on function test.expect_error(text, text) to authenticated;

-- ── users ──
insert into auth.users(id, email) select gen_random_uuid(), e from unnest(array[
  'owner@bls.test','admin@bls.test','cashier@bls.test','teacher1@bls.test','teacher2@bls.test',
  'guardianA@bls.test','guardianB@bls.test','outsider@bls.test']) e;
insert into test.ids select split_part(email,'@',1), id from auth.users;
insert into test.ids select 'school', id from public.schools;
insert into test.ids select 'year', id from public.academic_years where is_current;
insert into test.ids select 'secOne', s.id from public.sections s join public.classes c on c.id = s.class_id where c.name_en = 'Class One';
insert into test.ids select 'secKG',  s.id from public.sections s join public.classes c on c.id = s.class_id where c.name_en = 'KG';
insert into test.ids select 'tuition', id from public.fee_categories where name_en = 'Monthly Tuition';

-- profiles were auto-created by the signup trigger
do $t$ begin
  assert (select count(*) from public.profiles) = 8, 'profile trigger did not run';
end $t$;

-- ── T1: bootstrap owner; a second bootstrap is refused ──
select public.bootstrap_owner(test.id('owner'), test.id('school'));
select test.expect_error($$select public.bootstrap_owner(test.id('admin'), test.id('school'))$$, 'already has a Super Admin');

-- ── T2: nobody can self-promote to super admin ──
do $t$ begin
  perform test.login('outsider');
  perform test.expect_error($$insert into school_members(school_id,user_id,role_key)
     values (test.id('school'), test.id('outsider'), 'super_admin')$$, 'Only a Super Admin');
  perform test.expect_error($$insert into school_members(school_id,user_id,role_key)
     values (test.id('school'), test.id('outsider'), 'admin')$$, 'row-level security');
  assert (select count(*) from schools) = 0, 'outsider can see the school';
end $t$;

-- ── T3: invitation flow — owner invites; email must match; token single-use ──
do $t$
declare t_admin text; t_cash text; t_t1 text; t_t2 text;
begin
  perform test.login('owner');
  t_admin := create_invitation(test.id('school'), 'admin@bls.test', 'admin');
  t_cash  := create_invitation(test.id('school'), 'cashier@bls.test', 'accountant');
  t_t1    := create_invitation(test.id('school'), 'teacher1@bls.test', 'teacher');
  t_t2    := create_invitation(test.id('school'), 'teacher2@bls.test', 'teacher');
  perform test.expect_error($$select create_invitation(test.id('school'),'x@y.z','super_admin')$$, 'check constraint');
  -- accept as each user (switching identity mid-block)
  perform set_config('request.jwt.claim.sub', test.id('outsider')::text, true);
  perform test.expect_error(format('select accept_invitation(%L)', t_admin), 'different email');
  perform set_config('request.jwt.claim.sub', test.id('admin')::text, true);
  perform accept_invitation(t_admin);
  perform test.expect_error(format('select accept_invitation(%L)', t_admin), 'invalid or expired');
  perform set_config('request.jwt.claim.sub', test.id('cashier')::text, true);
  perform accept_invitation(t_cash);
  perform set_config('request.jwt.claim.sub', test.id('teacher1')::text, true);
  perform accept_invitation(t_t1);
  perform set_config('request.jwt.claim.sub', test.id('teacher2')::text, true);
  perform accept_invitation(t_t2);
end $t$;

-- ── T4: an admin cannot invite staff or grant themselves permissions ──
do $t$ begin
  perform test.login('admin');
  perform test.expect_error($$select create_invitation(test.id('school'),'evil@x.com','accountant','{"fees.reverse":true}')$$,
                            'Only the Super Admin');
  perform test.expect_error($$insert into member_permission_overrides
     select id, 'fees.reverse', true from school_members where user_id = test.id('admin')$$, 'row-level security');
  assert not has_perm(test.id('school'), 'fees.reverse'), 'admin escalated';
  assert has_perm(test.id('school'), 'students.create'), 'admin default permission missing';
end $t$;

-- ── T5: last super admin cannot be demoted ──
do $t$ begin
  perform test.login('owner');
  update school_members set role_key = 'admin' where user_id = test.id('owner');
  assert is_super_admin(test.id('school')), 'owner was demoted by direct update';
  perform test.expect_error($$select manage_school_member((select id from school_members where user_id=test.id('owner')), 'admin', 'active')$$, 'permission_denied');
end $t$;

-- ── setup academic data as admin ──
do $t$
declare s1 uuid; s2 uuid; g1 uuid; g2 uuid; st1 uuid; st2 uuid; tok text;
begin
  perform test.login('admin');
  insert into students(school_id, full_name_en, full_name_bn) values (test.id('school'),'Ayesha Rahman','আয়েশা রহমান') returning id into s1;
  insert into students(school_id, full_name_en) values (test.id('school'),'Rafi Ahmed') returning id into s2;
  insert into enrollments(school_id, student_id, academic_year_id, section_id, roll_no)
    values (test.id('school'), s1, test.id('year'), test.id('secOne'), 1),
           (test.id('school'), s2, test.id('year'), test.id('secKG'), 1);
  insert into guardians(school_id, full_name, phone) values (test.id('school'),'Karim Rahman','01711000000') returning id into g1;
  insert into guardians(school_id, full_name, phone) values (test.id('school'),'Nasir Ahmed','01811000000') returning id into g2;
  insert into student_guardians(student_id, guardian_id, school_id, relationship) values
    (s1, g1, test.id('school'), 'father'), (s2, g2, test.id('school'), 'father');
  insert into staff(school_id, full_name_en) values (test.id('school'), 'Teacher One') returning id into st1;
  insert into staff(school_id, full_name_en) values (test.id('school'), 'Teacher Two') returning id into st2;
  insert into teacher_assignments(school_id, staff_id, section_id, academic_year_id, is_class_teacher)
    values (test.id('school'), st1, test.id('secOne'), test.id('year'), true);
  insert into test.ids values ('s1', s1), ('s2', s2), ('g1', g1), ('g2', g2), ('st1', st1), ('st2', st2);
  assert (select student_code from students where id = s1) ~ '^\d{4}-0001$', 'student code not generated';
end $t$;

-- link staff & guardian accounts (as postgres; in the app this happens via invitation)
update public.staff set profile_id = test.id('teacher1') where id = test.id('st1');
update public.staff set profile_id = test.id('teacher2') where id = test.id('st2');
do $t$
declare ta text; tb text;
begin
  perform test.login('admin');
  ta := create_invitation(test.id('school'), 'guardianA@bls.test', 'guardian', '{"fees.reverse":true}', test.id('g1'));
  tb := create_invitation(test.id('school'), 'guardianB@bls.test', 'guardian', '{}', test.id('g2'));
  perform set_config('request.jwt.claim.sub', test.id('guardianA')::text, true);
  perform accept_invitation(ta);
  assert not has_perm(test.id('school'), 'fees.reverse'), 'guardian invite carried permissions';
  perform set_config('request.jwt.claim.sub', test.id('guardianB')::text, true);
  perform accept_invitation(tb);
end $t$;

-- ── T6 (Scenario C): guardian isolation ──
do $t$ begin
  perform test.login('guardianA');
  assert (select count(*) from students) = 1, 'guardian A sees wrong number of students';
  assert (select id from students) = test.id('s1'), 'guardian A sees someone else''s child';
  assert not exists (select 1 from students where id = test.id('s2')), 'guardian A can read child B by id';
  assert (select count(*) from guardians) = 1, 'guardian A can see other guardians';
  update students set full_name_en = 'x' where id = test.id('s1');
  delete from student_guardians;
  assert (select full_name_en from students where id = test.id('s1')) = 'Ayesha Rahman', 'guardian edited student';
  assert (select count(*) from fee_structures) >= 0;
  assert (select count(*) from audit_logs) = 0, 'guardian can read audit log';
end $t$;

-- ── T7: teacher scoping + attendance (Scenario D) ──
do $t$ begin
  perform test.login('teacher1');
  assert (select count(*) from students) = 1 and (select id from students) = test.id('s1'),
         'teacher1 should only see Class One students';
  perform submit_attendance(test.id('secOne'), local_today(test.id('school')),
    jsonb_build_array(jsonb_build_object('student_id', test.id('s1'), 'status', 'present')));
  -- resubmitting the same day must not duplicate
  perform submit_attendance(test.id('secOne'), local_today(test.id('school')),
    jsonb_build_array(jsonb_build_object('student_id', test.id('s1'), 'status', 'late')));
  assert (select count(*) from student_attendance) = 1, 'duplicate attendance row';
  perform test.expect_error($$select submit_attendance(test.id('secKG'), local_today(test.id('school')),
      jsonb_build_array(jsonb_build_object('student_id', test.id('s2'), 'status','present')))$$, 'Permission denied');
  perform test.expect_error($$select submit_attendance(test.id('secOne'), local_today(test.id('school')) - 3,
      jsonb_build_array(jsonb_build_object('student_id', test.id('s1'), 'status','absent')))$$, 'attendance.correct');
end $t$;
do $t$ begin
  perform test.login('teacher1');
  assert (select count(*) from payments) = 0 and (select count(*) from invoice_items) = 0, 'teacher sees finance';
  perform test.login('teacher2');
  assert (select count(*) from students) = 0, 'unassigned teacher sees students';
  perform test.login('guardianA');
  assert (select status from student_attendance where student_id = test.id('s1')) = 'late', 'guardian cannot see updated attendance';
  perform test.login('guardianB');
  assert (select count(*) from student_attendance) = 0, 'guardian B sees child A attendance';
end $t$;

-- ── T8 (Scenario B): ৳1,500 tuition payment reconciles everywhere ──
do $t$
declare item uuid; p1 payments; p2 payments; s jsonb;
begin
  perform test.login('owner');
  insert into fee_structures(school_id, academic_year_id, fee_category_id, class_id, amount)
    values (test.id('school'), test.id('year'), test.id('tuition'), null, 150000);   -- ৳1,500
  assert generate_monthly_charges(test.id('school'), local_today(test.id('school'))) = 2, 'expected 2 charges';
  assert generate_monthly_charges(test.id('school'), local_today(test.id('school'))) = 0, 'monthly billing not idempotent';

  perform test.login('cashier');
  select item_id into item from invoice_item_balances where student_id = test.id('s1');
  assert (select outstanding from invoice_item_balances where item_id = item) = 150000;

  p1 := post_payment(test.id('s1'), 150000, 'cash', null,
          jsonb_build_array(jsonb_build_object('item_id', item, 'amount', 150000)), 'idem-key-0001');
  -- double tap with the same key returns the same receipt, no second payment
  p2 := post_payment(test.id('s1'), 150000, 'cash', null,
          jsonb_build_array(jsonb_build_object('item_id', item, 'amount', 150000)), 'idem-key-0001');
  assert p1.id = p2.id and p1.receipt_no = p2.receipt_no, 'idempotency failed';
  assert (select count(*) from payments) = 1, 'duplicate payment posted';
  assert p1.receipt_no ~ '^BLS-\d{4}-000001$', 'unexpected receipt number ' || p1.receipt_no;
  assert (select outstanding from invoice_item_balances where item_id = item) = 0, 'balance not reduced';

  -- a second payment cannot over-pay the same charge
  perform test.expect_error(format($f$select post_payment(%L, 1000, 'cash', null,
      jsonb_build_array(jsonb_build_object('item_id', %L, 'amount', 1000)), 'idem-key-0002')$f$,
      test.id('s1'), item), 'exceeds outstanding');
  -- wallet payments need a reference and are flagged unverified
  perform test.expect_error(format($f$select post_payment(%L, 5000, 'bkash', null, '[]', 'idem-key-0003')$f$,
      test.id('s1')), 'reference is required');
  p2 := post_payment(test.id('s1'), 5000, 'bkash', 'TRX9A8B7C', '[]', 'idem-key-0004');
  assert p2.verification_status = 'unverified', 'bKash must be unverified';
  assert student_credit(test.id('s1')) = 5000, 'advance credit wrong';

  -- cashier cannot edit, delete or reverse payments
  update payments set amount = 1;
  assert (select sum(amount) from payments) = 155000, 'cashier changed a payment';
  delete from payments;
  assert (select count(*) from payments) = 2, 'cashier deleted a payment';
  perform test.expect_error(format('select reverse_payment(%L, %L)', p1.id, 'mistake here'), 'fees.reverse');
end $t$;

do $t$ declare s jsonb; begin
  -- guardian sees the payment and zero balance; guardian B sees nothing
  perform test.login('guardianA');
  assert (select count(*) from payments) = 2, 'guardian A cannot see payments';
  assert (select sum(outstanding) from invoice_item_balances) = 0, 'guardian balance wrong';
  perform test.login('guardianB');
  assert (select count(*) from payments) = 0, 'guardian B sees child A payments';
  assert (select sum(outstanding) from invoice_item_balances) = 150000, 'guardian B balance wrong';

  -- owner reports reconcile
  perform test.login('owner');
  s := finance_summary(test.id('school'), local_today(test.id('school')), local_today(test.id('school')));
  assert (s->>'collected_gross')::bigint = 155000, 'report collected ' || (s->>'collected_gross');
  assert (s->'collected_by_method'->>'cash')::bigint = 150000;
  assert (s->>'unverified_wallet_bank')::bigint = 5000;
  assert (s->>'outstanding_now')::bigint = 150000, 'outstanding ' || (s->>'outstanding_now');

  -- direct table writes are impossible even for the owner (RPC only)
  perform test.expect_error($$insert into payments(school_id, student_id, receipt_no, amount, method,
      verification_status, paid_on, collected_by, idempotency_key)
      values (test.id('school'), test.id('s1'), 'X', 1, 'cash', 'not_applicable', current_date, auth.uid(), 'zzzzzzzzzz')$$,
      'row-level security');
end $t$;

-- ── T9: reversal restores balance, is audited, and cannot repeat ──
do $t$ declare pid uuid; s jsonb; begin
  perform test.login('owner');
  select id into pid from payments where method = 'cash';
  perform test.expect_error(format('select reverse_payment(%L, %L)', pid, 'x'), 'reason is required');
  perform reverse_payment(pid, 'Entered for wrong student');
  perform test.expect_error(format('select reverse_payment(%L, %L)', pid, 'again please'), 'already reversed');
  assert (select outstanding from invoice_item_balances where student_id = test.id('s1')) = 150000, 'reversal did not restore balance';
  assert exists (select 1 from audit_logs where action = 'payment.reverse' and reason = 'Entered for wrong student');
  s := finance_summary(test.id('school'), local_today(test.id('school')), local_today(test.id('school')));
  assert (s->>'collected_gross')::bigint = 5000, 'reversed payment still counted';
  assert (select count(*) from payments) = 2, 'payment row was deleted';
  delete from audit_logs;
  assert (select count(*) from audit_logs where action = 'payment.reverse') = 1, 'audit log deleted';
end $t$;
-- even the database owner cannot alter confirmed payments or the audit log
select test.expect_error($$update public.payments set amount = 1$$, 'cannot be modified');
select test.expect_error($$delete from public.audit_logs$$, 'cannot be modified');

-- ── T10: expenses need approval; approved ones are frozen ──
do $t$ declare eid uuid; s jsonb; begin
  perform test.login('cashier');
  insert into expenses(school_id, category_id, amount, description, spent_on, method, created_by)
  select test.id('school'), id, 300000, 'October rent', local_today(test.id('school')), 'cash', auth.uid()
    from expense_categories where name_en = 'Rent' returning id into eid;
  perform test.expect_error(format('select decide_expense(%L, true)', eid), 'expenses.approve');
  perform test.login('owner');
  perform decide_expense(eid, true, 'ok');
  s := finance_summary(test.id('school'), local_today(test.id('school')), local_today(test.id('school')));
  assert (s->>'expenses_approved')::bigint = 300000;
  assert (s->>'surplus')::bigint = 5000 - 300000, 'surplus wrong';
  perform test.login('cashier');
  update expenses set amount = 1 where id = eid;
  perform test.login('owner');
  assert (select amount from expenses where id = eid) = 300000, 'approved expense changed';
end $t$;

-- ── T11: marks validation and unpublished results hidden from guardians ──
do $t$ declare ex uuid; es uuid; begin
  perform test.login('admin');
  insert into exams(school_id, academic_year_id, name_en, kind, status)
    values (test.id('school'), test.id('year'), 'Half Yearly', 'half_yearly', 'marks_entry') returning id into ex;
  insert into exam_subjects(exam_id, class_id, subject_id, full_marks, pass_marks)
    select ex, s.class_id, sub.id, 100, 33 from sections s, subjects sub
    where s.id = test.id('secOne') and sub.name_en = 'Mathematics' returning id into es;
  insert into test.ids values ('exam', ex), ('es', es);
  perform test.login('teacher1');
  perform test.expect_error(format($f$select save_exam_marks(%L, jsonb_build_array(jsonb_build_object('student_id',%L,'marks_obtained',120,'is_absent',false)))$f$, es, test.id('s1')), 'invalid_marks');
  perform save_exam_marks(es, jsonb_build_array(jsonb_build_object('student_id',test.id('s1'),'marks_obtained',87,'is_absent',false)));
  perform test.login('guardianA');
  assert (select count(*) from marks) = 0, 'guardian sees unpublished marks';
  perform test.login('admin');
  perform publish_exam(ex);
  perform test.login('guardianA');
  assert (select marks_obtained from marks) = 87, 'guardian cannot see published marks';
  perform test.login('guardianB');
  assert (select count(*) from marks) = 0, 'guardian B sees child A marks';
end $t$;

-- ── T12: notices reach the right people only ──
do $t$ begin
  perform test.login('teacher1');
  insert into notices(school_id, title, body, audience, target_ids, created_by)
    values (test.id('school'), 'Class One picnic', 'Bring lunch', 'sections', array[test.id('secOne')], auth.uid());
  perform test.expect_error($$insert into notices(school_id, title, body, audience, target_ids, created_by)
    values (test.id('school'), 'KG', 'x', 'sections', array[test.id('secKG')], auth.uid())$$, 'row-level security');
  perform test.login('guardianA');
  assert (select count(*) from notices) = 1, 'guardian A should see section notice';
  assert (select count(*) from notifications where read_at is null) = 1, 'notification not fanned out';
  perform test.login('guardianB');
  assert (select count(*) from notices) = 0 and (select count(*) from notifications) = 0, 'guardian B sees class one notice';
end $t$;

-- ── T13 (Scenario F): branding is editable only by settings.manage ──
do $t$ begin
  perform test.login('admin');
  update schools set name_en = 'Hacked' where id = test.id('school');
  perform test.login('owner');
  assert (select name_en from schools) = 'Bright Learning School', 'admin changed school name';
  update schools set name_en = 'Bright Learning School & College', upazila = 'Kanaighat' where id = test.id('school');
  assert (select name_en from schools) = 'Bright Learning School & College', 'owner cannot edit school';
  update schools set name_en = 'Bright Learning School' where id = test.id('school');
end $t$;

select 'security & finance tests: OK' as result;
