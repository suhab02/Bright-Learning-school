-- seed/school.sql — run ONCE after migrations. Creates the school record.
-- Every value here can be changed later in Settings → School profile. No students,
-- payments or attendance are created: the production database starts empty.

do $$
declare sch uuid; yr uuid; this_year int := extract(year from (now() at time zone 'Asia/Dhaka'))::int;
        scale uuid;
begin
  if exists (select 1 from public.schools) then
    raise notice 'A school already exists — seed skipped';
    return;
  end if;

  insert into public.schools (name_en, name_bn, village_area, upazila, district, division,
                              slogan_en, slogan_bn, receipt_prefix, default_locale)
  values ('Bright Learning School', 'ব্রাইট লার্নিং স্কুল',
          'Mulagul', 'Kanaighat', 'Sylhet', 'Sylhet',
          'Learning with joy', 'আনন্দের সাথে শেখা', 'BLS', 'bn')
  returning id into sch;

  insert into public.academic_years (school_id, name, starts_on, ends_on, is_current)
  values (sch, this_year::text, make_date(this_year,1,1), make_date(this_year,12,31), true)
  returning id into yr;

  insert into public.classes (school_id, name_en, name_bn, sort_order) values
    (sch,'Playgroup','প্লে গ্রুপ',1), (sch,'Nursery','নার্সারি',2), (sch,'KG','কেজি',3),
    (sch,'Class One','প্রথম শ্রেণি',4), (sch,'Class Two','দ্বিতীয় শ্রেণি',5),
    (sch,'Class Three','তৃতীয় শ্রেণি',6), (sch,'Class Four','চতুর্থ শ্রেণি',7),
    (sch,'Class Five','পঞ্চম শ্রেণি',8);
  insert into public.sections (school_id, class_id, name)
    select sch, id, 'A' from public.classes where school_id = sch;

  insert into public.subjects (school_id, name_en, name_bn) values
    (sch,'Bangla','বাংলা'), (sch,'English','ইংরেজি'), (sch,'Mathematics','গণিত'),
    (sch,'Bangladesh & Global Studies','বাংলাদেশ ও বিশ্বপরিচয়'), (sch,'Science','বিজ্ঞান'),
    (sch,'Religion & Moral Education','ধর্ম ও নৈতিক শিক্ষা'), (sch,'Drawing','অঙ্কন');

  insert into public.fee_categories (school_id, name_en, name_bn, frequency, sort_order) values
    (sch,'Monthly Tuition','মাসিক বেতন','monthly',1),
    (sch,'Admission Fee','ভর্তি ফি','one_time',2),
    (sch,'Session Fee','সেশন ফি','annual',3),
    (sch,'Examination Fee','পরীক্ষা ফি','one_time',4),
    (sch,'Books & Stationery','বই ও খাতা','one_time',5),
    (sch,'Transport Fee','যাতায়াত ফি','monthly',6),
    (sch,'Late Fee','বিলম্ব ফি','one_time',7);

  insert into public.expense_categories (school_id, name_en, name_bn) values
    (sch,'Staff Salaries','কর্মচারী বেতন'), (sch,'Rent','ভাড়া'), (sch,'Electricity','বিদ্যুৎ'),
    (sch,'Internet','ইন্টারনেট'), (sch,'Classroom Supplies','শ্রেণিকক্ষ সামগ্রী'),
    (sch,'Furniture','আসবাবপত্র'), (sch,'Repairs','মেরামত'), (sch,'School Events','স্কুল অনুষ্ঠান'),
    (sch,'Utilities','ইউটিলিটি'), (sch,'Transportation','যাতায়াত'), (sch,'Miscellaneous','বিবিধ');

  insert into public.grade_scales (school_id, name, is_default) values (sch, 'Bangladesh GPA (5.00)', true)
    returning id into scale;
  insert into public.grade_bands (scale_id, min_percent, max_percent, grade, grade_point) values
    (scale,80,100,'A+',5.00), (scale,70,79.99,'A',4.00), (scale,60,69.99,'A-',3.50),
    (scale,50,59.99,'B',3.00), (scale,40,49.99,'C',2.00), (scale,33,39.99,'D',1.00),
    (scale,0,32.99,'F',0.00);

  insert into public.periods (school_id, name, starts_at, ends_at, sort_order) values
    (sch,'1','08:30','09:10',1), (sch,'2','09:10','09:50',2), (sch,'3','09:50','10:30',3),
    (sch,'Break','10:30','10:50',4), (sch,'4','10:50','11:30',5), (sch,'5','11:30','12:10',6);
end $$;
