import { Suspense } from "react";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { can, requireContext } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { supabaseServer } from "@/lib/supabase/server";
import { schoolRows, relatedRows, str, named } from "@/lib/workflows/data";
import { Card, Notice, Skeleton } from "@/components/ui";
import { PageHeader, SectionTitle } from "@/components/page";
import { WorkflowForm } from "@/components/workflow-form";
import { MarksRegister, type MarkRow } from "@/components/marks-register";
async function Exam({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext();
  const [{ id }, { locale }, db] = await Promise.all([
    params,
    getT(),
    supabaseServer(),
  ]);
  const L = (en: string, bn: string) => (locale === "bn" ? bn : en);
  if (ctx.role === "guardian")
    return (
      <Notice tone="warn">
        {L(
          "View published results in your parent portal.",
          "অভিভাবক পোর্টালে প্রকাশিত ফলাফল দেখুন।",
        )}
      </Notice>
    );
  const { data: exam, error } = await db
    .from("exams")
    .select("*")
    .eq("id", id)
    .eq("school_id", ctx.schoolId)
    .maybeSingle();
  if (error) throw error;
  if (!exam) notFound();
  const [subjects, classes, names] = await Promise.all([
    relatedRows("exam_subjects", "exam_id", [id]),
    schoolRows("classes", ctx.schoolId, "sort_order"),
    schoolRows("subjects", ctx.schoolId, "name_en"),
  ]);
  const rosters = await Promise.all(
    subjects.map(async (s) => {
      const r = await db.rpc("exam_marks_roster", {
        p_exam_subject: str(s, "id"),
      });
      if (r.error && r.error.code !== "42501") throw r.error;
      return {
        subject: s,
        rows: (r.data ?? []) as MarkRow[],
        allowed: !r.error,
      };
    }),
  );
  return (
    <div>
      <PageHeader title={named(exam, locale)} back="/exams" />
      <Notice>
        {exam.status === "published"
          ? L(
              "Results are published and locked.",
              "ফলাফল প্রকাশিত ও লক করা হয়েছে।",
            )
          : L(
              "Add each subject, enter every student's marks or absence, then publish. Parents only see published results.",
              "বিষয় যোগ করুন, প্রতিটি শিক্ষার্থীর নম্বর বা অনুপস্থিতি লিখুন, তারপর প্রকাশ করুন। অভিভাবকেরা শুধু প্রকাশিত ফলাফল দেখেন।",
            )}
      </Notice>
      {can(ctx, "exams.manage") && exam.status !== "published" && (
        <Card className="my-4 p-4">
          <h2 className="mb-3 font-bold">
            {L("Add exam subject", "পরীক্ষার বিষয় যোগ করুন")}
          </h2>
          <WorkflowForm
            operation="exam_subject"
            locale={locale}
            hidden={{ id: randomUUID(), exam_id: id }}
            fields={[
              {
                name: "class_id",
                label: L("Class", "শ্রেণি"),
                required: true,
                options: classes.map((c) => ({
                  value: str(c, "id"),
                  label: named(c, locale),
                })),
              },
              {
                name: "subject_id",
                label: L("Subject", "বিষয়"),
                required: true,
                options: names.map((c) => ({
                  value: str(c, "id"),
                  label: named(c, locale),
                })),
              },
              {
                name: "full_marks",
                label: L("Full marks", "পূর্ণ নম্বর"),
                type: "number",
                required: true,
                value: "100",
                min: "1",
                max: "9999",
                step: "0.01",
              },
              {
                name: "pass_marks",
                label: L("Pass marks", "পাস নম্বর"),
                type: "number",
                required: true,
                value: "33",
                min: "0",
                max: "9999",
                step: "0.01",
              },
              {
                name: "exam_date",
                label: L("Exam date", "পরীক্ষার তারিখ"),
                type: "date",
              },
            ]}
          />
        </Card>
      )}
      {rosters.map(({ subject, rows, allowed }) => (
        <section key={str(subject, "id")}>
          <SectionTitle>
            {named(
              classes.find((c) => str(c, "id") === str(subject, "class_id")) ??
                {},
              locale,
            )}{" "}
            ·{" "}
            {named(
              names.find((c) => str(c, "id") === str(subject, "subject_id")) ??
                {},
              locale,
            )}
          </SectionTitle>
          <Card className="p-4">
            {exam.status !== "published" &&
            allowed &&
            (can(ctx, "marks.enter") || ctx.role === "teacher") &&
            rows.length ? (
              <MarksRegister
                key={`${str(subject, "id")}:${rows.map((r) => r.updated_at).join(",")}`}
                rows={rows.map((r) => ({
                  ...r,
                  marks_obtained:
                    r.marks_obtained === null ? null : Number(r.marks_obtained),
                }))}
                examSubject={str(subject, "id")}
                fullMarks={Number(subject.full_marks)}
                locale={locale}
              />
            ) : rows.length ? (
              <ul className="divide-y divide-line">
                {rows.map((r) => (
                  <li key={r.student_id} className="py-3">
                    <p className="font-semibold">
                      {locale === "bn"
                        ? r.full_name_bn || r.full_name_en
                        : r.full_name_en}
                    </p>
                    <p>
                      {r.is_absent
                        ? L("Absent", "অনুপস্থিত")
                        : `${r.marks_obtained ?? "—"} / ${str(subject, "full_marks")}`}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-2">
                {allowed
                  ? L(
                      "No active students in this class.",
                      "এই শ্রেণিতে সক্রিয় শিক্ষার্থী নেই।",
                    )
                  : L(
                      "Your assigned subjects can be edited here.",
                      "আপনার নির্ধারিত বিষয় এখানে সম্পাদনা করতে পারবেন।",
                    )}
              </p>
            )}
          </Card>
        </section>
      ))}
      {can(ctx, "results.publish") && exam.status !== "published" && (
        <Card className="mt-5 p-4">
          <WorkflowForm
            operation="publish_exam"
            locale={locale}
            hidden={{ id }}
            fields={[]}
            submit={L(
              "Publish results to parents",
              "অভিভাবকদের জন্য ফলাফল প্রকাশ করুন",
            )}
          />
        </Card>
      )}
    </div>
  );
}
export default function Page({ params }: PageProps<"/exams/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Exam params={params} />
    </Suspense>
  );
}
