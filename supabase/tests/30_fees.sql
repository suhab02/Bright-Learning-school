-- 30_fees.sql — fee rates, collection with server-side allocation, credit, balances, privacy
-- Runs after 10 and 20 (reuses users, students s1/s2/s3, helpers).

do $t$ declare kg uuid; one uuid; adm uuid; n int; begin
  select class_id into one from sections where id = test.id('secOne');
  select class_id into kg from sections where id = test.id('secKG');
  insert into test.ids values ('classOne', one), ('classKG', kg);
  select id into adm from fee_categories where name_en = 'Admission Fee';
  insert into test.ids values ('admission', adm);

  perform test.login('admin');   -- admins don't configure fees by default
  perform test.expect_error(format($f$select set_fee_rates(%L, '[]')$f$, test.id('tuition')), 'fees.configure');

  perform test.login('owner');
  n := set_fee_rates(test.id('tuition'), jsonb_build_array(
         jsonb_build_object('class_id', one, 'amount', 120000),      -- ৳1,200
         jsonb_build_object('class_id', kg,  'amount', 100000)));    -- ৳1,000
  assert n = 2, 'expected 2 rates';
  -- setting again replaces, never duplicates
  n := set_fee_rates(test.id('tuition'), jsonb_build_array(jsonb_build_object('class_id', one, 'amount', 125000)));
  assert (select count(*) from fee_structures fs where fs.fee_category_id = test.id('tuition') and fs.class_id = one) = 1;
  assert (select amount from fee_structures fs where fs.fee_category_id = test.id('tuition') and fs.class_id = one) = 125000;
  perform test.expect_error(format($f$select set_fee_rates(%L, jsonb_build_array(jsonb_build_object('class_id', %L, 'amount', -5)))$f$,
    test.id('tuition'), one), 'invalid_amount');
end $t$;

-- collection: oldest due first, decided by the database; leftover → advance credit
do $t$ declare p payments; due bigint; s3 uuid := test.id('s3'); i1 uuid; i2 uuid; begin
  perform test.login('owner');
  -- two charges for s3 (KG): admission ৳500 due earlier, tuition ৳1,000 later
  i1 := add_charge(s3, test.id('admission'), 50000, local_today(test.id('school')) - 30, null, 'Admission');
  i2 := add_charge(s3, test.id('tuition'), 100000, local_today(test.id('school')), local_today(test.id('school')), null);
  assert (select outstanding from student_fee_balances where student_id = s3) = 150000;
  assert (select overdue from student_fee_balances where student_id = s3) = 50000, 'overdue should be the admission fee';

  perform test.login('cashier');
  p := collect_fee(s3, 80000, 'cash', null, null, 'fee-key-000001');   -- ৳800
  assert (select outstanding from invoice_item_balances where item_id = i1) = 0, 'oldest charge not paid first';
  assert (select outstanding from invoice_item_balances where item_id = i2) = 70000;
  -- replay returns the same receipt
  assert (collect_fee(s3, 80000, 'cash', null, null, 'fee-key-000001')).id = p.id, 'replay posted twice';
  assert (select count(*) from payments where student_id = s3) = 1;

  -- pay more than owed: the extra becomes advance credit
  p := collect_fee(s3, 100000, 'nagad', 'NGD123', null, 'fee-key-000002');
  assert p.verification_status = 'unverified';
  assert (select outstanding from student_fee_balances where student_id = s3) = 0;
  assert student_credit(s3) = 30000, 'expected ৳300 credit, got ' || student_credit(s3);

  -- only chosen charges are paid when the cashier picks specific ones
  perform test.login('owner');
  i1 := add_charge(s3, test.id('admission'), 20000, local_today(test.id('school')), null, 'Books');
  i2 := add_charge(s3, test.id('admission'), 20000, local_today(test.id('school')) - 1, null, 'Exam');
  perform test.login('cashier');
  p := collect_fee(s3, 20000, 'cash', null, array[i1], 'fee-key-000003');
  assert (select outstanding from invoice_item_balances where item_id = i1) = 0;
  assert (select outstanding from invoice_item_balances where item_id = i2) = 20000, 'unselected charge was paid';

  -- advance credit (৳300) pays the remaining ৳200
  assert use_advance_credit(s3) = 20000;
  assert (select outstanding from student_fee_balances where student_id = s3) = 0;
  assert student_credit(s3) = 10000;
end $t$;

-- privacy and permissions
do $t$ begin
  perform test.login('teacher1');
  assert (select count(*) from student_fee_balances) = 0, 'teacher sees fee balances';
  perform test.expect_error(format('select student_credit(%L)', test.id('s3')), 'Permission denied');
  perform test.expect_error(format($f$select collect_fee(%L, 100, 'cash', null, null, 'fee-key-zzzzzz')$f$, test.id('s3')), 'fees.collect');
  perform test.login('guardianA');            -- parent of s1 and s3
  assert (select count(*) from student_fee_balances) = 2, 'guardian A should see 2 children';
  assert student_credit(test.id('s3')) = 10000, 'guardian should see own child credit';
  perform test.login('guardianB');
  assert not exists (select 1 from student_fee_balances where student_id = test.id('s3')), 'guardian B sees s3 fees';
  perform test.expect_error(format('select student_credit(%L)', test.id('s3')), 'Permission denied');
  perform test.login('cashier');
  assert staff_name(auth.uid()) is not null;
end $t$;

select 'fee tests: OK' as result;
