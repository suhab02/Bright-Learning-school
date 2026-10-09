import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireContext } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { supabaseServer } from "@/lib/supabase/server";
import { type Row, str, named } from "@/lib/workflows/data";
import { Card, Skeleton, Notice } from "@/components/ui";
import { PageHeader, SectionTitle } from "@/components/page";
import { WorkflowForm } from "@/components/workflow-form";
async function Homework({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext();
  const [{ id }, { locale }, db] = await Promise.all([
    params,
    getT(),
    supabaseServer(),
  ]);
  const L = (en: string, bn: string) => (locale === "bn" ? bn : en);
  const { data: h, error } = await db
    .from("homework")
    .select("*")
    .eq("id", id)
    .eq("school_id", ctx.schoolId)
    .maybeSingle();
  if (error) throw error;
  if (!h) notFound();
  const { data: rows, error: rosterError } =
    ctx.role !== "guardian"
      ? await db.rpc("homework_completion_roster", { p_homework: id })
      : { data: [], error: null };
  if (rosterError) throw rosterError;
  return (
    <div>
      <PageHeader
        title={h.title}
        back={ctx.role === "guardian" ? "/portal/homework" : "/homework"}
      />
      <Card className="p-4">
        <p className="whitespace-pre-wrap break-words">{h.instructions}</p>
        <p className="mt-3 text-sm text-ink-2">
          {L("Due", "শেষ তারিখ")}: {h.due_on || "—"}
        </p>
      </Card>
      {ctx.role !== "guardian" && (
        <>
          <SectionTitle>
            {L("Student progress", "শিক্ষার্থীর অগ্রগতি")}
          </SectionTitle>
          {((rows as Row[]) ?? []).map((r) => (
            <Card key={str(r, "student_id")} className="mb-3 p-4">
              <h2 className="mb-3 font-bold">
                {named(r, locale)} · {str(r, "roll_no")}
              </h2>
              <WorkflowForm
                locale={locale}
                operation="homework_completion"
                hidden={{ homework_id: id, student_id: str(r, "student_id") }}
                fields={[
                  {
                    name: "status",
                    label: L("Progress", "অগ্রগতি"),
                    value: str(r, "status"),
                    options: [
                      { value: "pending", label: L("Pending", "অপেক্ষমান") },
                      {
                        value: "submitted",
                        label: L("Submitted", "জমা দেওয়া"),
                      },
                      { value: "completed", label: L("Completed", "সম্পন্ন") },
                      { value: "late", label: L("Late", "দেরিতে") },
                    ],
                  },
                  {
                    name: "teacher_note",
                    label: L("Teacher note", "শিক্ষকের মন্তব্য"),
                    value: str(r, "teacher_note"),
                    type: "textarea",
                  },
                ]}
              />
            </Card>
          ))}
          {!rows?.length && (
            <Notice>
              {L(
                "No active students in this section.",
                "এই শাখায় সক্রিয় শিক্ষার্থী নেই।",
              )}
            </Notice>
          )}
        </>
      )}
    </div>
  );
}
export default function Page({ params }: PageProps<"/homework/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Homework params={params} />
    </Suspense>
  );
}
