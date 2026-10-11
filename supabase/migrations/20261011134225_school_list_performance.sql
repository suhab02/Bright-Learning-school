-- Index school-scoped lists without changing rows or access policies.
create index if not exists fee_structures_school_id_idx on public.fee_structures(school_id);
create index if not exists exams_school_id_idx on public.exams(school_id);
create index if not exists homework_school_id_due_on_idx on public.homework(school_id, due_on desc);
create index if not exists marks_school_id_idx on public.marks(school_id);
