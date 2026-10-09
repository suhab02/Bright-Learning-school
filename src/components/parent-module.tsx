import Link from "next/link";
import { GraduationCap, NotebookPen } from "lucide-react";
import { redirect } from "next/navigation";
import { requireContext } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { schoolRows, relatedRows, str, named } from "@/lib/workflows/data";
import { getStudentLedger } from "@/lib/data/fees";
import { supabaseServer } from "@/lib/supabase/server";
import { formatTaka } from "@/lib/format";
import { Card, Notice } from "./ui";
import { Chip, EmptyState, PageHeader, SectionTitle } from "./page";
import { WorkflowForm } from "./workflow-form";
export type ParentModuleKind =
  | "home"
  | "fees"
  | "homework"
  | "profile"
  | "results";
export async function ParentModule({ kind }: { kind: ParentModuleKind }) {
  const ctx = await requireContext();
  if (ctx.role !== "guardian") redirect("/dashboard");
  const { locale, t } = await getT();
  const L = (en: string, bn: string) => (locale === "bn" ? bn : en);
  const children = await schoolRows(
    "student_directory",
    ctx.schoolId,
    "full_name_en",
  );
  let content: React.ReactNode;
  switch (kind) {
    case "home": {
      const notices = await schoolRows(
        "notices",
        ctx.schoolId,
        "created_at",
        false,
      );
      content = (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3">
            {[
              ["/portal/attendance", t.nav.attendance],
              ["/portal/homework", t.nav.homework],
              ["/portal/fees", t.nav.fees],
              ["/portal/results", L("Results", "ফলাফল")],
            ].map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="press rounded-2xl bg-surface p-4 font-bold text-brand card-shadow"
              >
                {label}
              </Link>
            ))}
          </div>
          {children.map((child) => (
            <Card key={str(child, "id")} className="mb-3 p-4">
              <h2 className="text-xl font-bold">{named(child, locale)}</h2>
              <p className="text-ink-2">
                {str(
                  child,
                  locale === "bn" ? "class_name_bn" : "class_name_en",
                )}{" "}
                ({str(child, "section_name")}) · {L("Roll", "রোল")}{" "}
                {str(child, "roll_no") || "—"}
              </p>
              <p className="text-sm">{str(child, "student_code")}</p>
            </Card>
          ))}
          <SectionTitle>{t.nav.notices}</SectionTitle>
          {notices
            .filter((n) => n.is_published)
            .slice(0, 10)
            .map((n) => (
              <Card key={str(n, "id")} className="mb-3 p-4">
                <Link
                  className="font-bold text-brand"
                  href={`/notices/${str(n, "id")}`}
                >
                  {str(n, "title")}
                </Link>
                <p className="mt-2 whitespace-pre-wrap break-words">
                  {str(n, "body")}
                </p>
              </Card>
            ))}
          <SectionTitle>
            {L("School calendar", "স্কুল ক্যালেন্ডার")}
          </SectionTitle>
          {(await schoolRows("calendar_events", ctx.schoolId, "starts_on")).map(
            (e) => (
              <Card key={str(e, "id")} className="mb-3 p-4">
                <p className="font-bold">
                  {str(e, locale === "bn" ? "title_bn" : "title_en") ||
                    str(e, "title_en")}
                </p>
                <p className="text-sm">
                  {str(e, "starts_on")} — {str(e, "ends_on")}
                </p>
              </Card>
            ),
          )}
        </>
      );
      break;
    }
    case "fees": {
      const ledgers = await Promise.all(
        children.map(async (child) => ({
          child,
          ledger: await getStudentLedger(str(child, "id")),
        })),
      );
      content = (
        <>
          {ledgers.map(({ child, ledger }) => (
            <Card key={str(child, "id")} className="mb-4 p-4">
              <h2 className="text-xl font-bold">{named(child, locale)}</h2>
              <p className="mt-2 font-bold">
                {L("Due", "বকেয়া")}: {formatTaka(ledger.due)}
              </p>
              <p className="text-sm">
                {L("Advance", "অগ্রিম")}: {formatTaka(ledger.credit)}
              </p>
              <SectionTitle>{L("Charges", "ধার্য ফি")}</SectionTitle>
              <ul className="divide-y divide-line">
                {ledger.charges.map((c) => (
                  <li key={c.item_id} className="py-3">
                    <p className="font-semibold">
                      {locale === "bn" ? c.category_bn : c.category_en} ·{" "}
                      {c.billing_period?.slice(0, 7) || c.description}
                    </p>
                    <p className="text-sm">
                      {L("Due date", "শেষ তারিখ")}: {c.due_on}
                    </p>
                    <p>
                      {formatTaka(c.amount)} · {L("Outstanding", "বকেয়া")}:{" "}
                      {formatTaka(c.outstanding)}
                    </p>
                  </li>
                ))}
              </ul>
              <SectionTitle>
                {L("Payments and receipts", "পরিশোধ ও রসিদ")}
              </SectionTitle>
              {ledger.payments.map((p) => (
                <Link
                  key={p.id}
                  href={`/receipts/${p.id}`}
                  className="my-2 block rounded-xl bg-surface-2 p-3"
                >
                  <p className="font-semibold">
                    {p.receipt_no} · {formatTaka(p.amount)}
                  </p>
                  <p className="text-sm">
                    {p.paid_on} ·{" "}
                    {t.fees.methods[p.method as keyof typeof t.fees.methods]} ·{" "}
                    {p.status === "reversed"
                      ? L("Reversed", "বাতিল")
                      : L("Confirmed", "নিশ্চিত")}
                  </p>
                </Link>
              ))}
              {!ledger.charges.length && !ledger.payments.length && (
                <p className="mt-3 text-sm text-ink-2">
                  {L("No fee records yet", "এখনো ফি রেকর্ড নেই")}
                </p>
              )}
            </Card>
          ))}
        </>
      );
      break;
    }
    case "homework": {
      const [homework, statuses] = await Promise.all([
        schoolRows("homework", ctx.schoolId, "created_at", false),
        schoolRows("homework_status", ctx.schoolId, "updated_at"),
      ]);
      content = (
        <>
          {children.map((child) => {
            const work = homework.filter(
              (h) =>
                h.status === "published" &&
                str(h, "section_id") === str(child, "section_id"),
            );
            return (
              <div key={str(child, "id")}>
                <SectionTitle>{named(child, locale)}</SectionTitle>
                {work.length ? (
                  work.map((h) => {
                    const progress = statuses.find(
                      (s) =>
                        str(s, "homework_id") === str(h, "id") &&
                        str(s, "student_id") === str(child, "id"),
                    );
                    return (
                      <Card key={str(h, "id")} className="mb-3 p-4">
                        <h3 className="text-lg font-bold">{str(h, "title")}</h3>
                        <p className="mt-2 whitespace-pre-wrap break-words">
                          {str(h, "instructions")}
                        </p>
                        <p className="my-2 text-sm text-ink-2">
                          {L("Due", "শেষ তারিখ")}: {str(h, "due_on") || "—"}
                        </p>
                        <Chip>
                          {L(
                            str(progress ?? {}, "status") || "pending",
                            (
                              {
                                pending: "অপেক্ষমান",
                                submitted: "জমা দেওয়া",
                                completed: "সম্পন্ন",
                                late: "দেরিতে",
                              } as Record<string, string>
                            )[str(progress ?? {}, "status") || "pending"],
                          )}
                        </Chip>
                        {progress && Boolean(progress.teacher_note) && (
                          <p className="mt-2 text-sm">
                            {L("Teacher note", "শিক্ষকের মন্তব্য")}:{" "}
                            {str(progress, "teacher_note")}
                          </p>
                        )}
                      </Card>
                    );
                  })
                ) : (
                  <EmptyState
                    icon={NotebookPen}
                    title={L(
                      "No published homework",
                      "প্রকাশিত বাড়ির কাজ নেই",
                    )}
                  />
                )}
              </div>
            );
          })}
        </>
      );
      break;
    }
    case "profile": {
      const guardians = await schoolRows("guardians", ctx.schoolId);
      const me = guardians.find((g) => str(g, "profile_id") === ctx.userId);
      content = me ? (
        <Card className="p-4">
          <p className="mb-3 text-xl font-bold">{str(me, "full_name")}</p>
          <p className="mb-4 break-all text-sm text-ink-2">{ctx.email}</p>
          <WorkflowForm
            locale={locale}
            operation="guardian_contact"
            fields={[
              {
                name: "phone",
                label: L("Phone", "ফোন"),
                type: "tel",
                required: true,
                value: str(me, "phone"),
              },
              {
                name: "address",
                label: L("Address", "ঠিকানা"),
                type: "textarea",
                value: str(me, "address"),
              },
            ]}
          />
        </Card>
      ) : (
        <Notice>
          {L(
            "Your school has not linked a guardian record yet. Contact the office.",
            "আপনার অভিভাবক রেকর্ড যুক্ত করা হয়নি। অফিসে যোগাযোগ করুন।",
          )}
        </Notice>
      );
      break;
    }
    case "results": {
      const db = await supabaseServer();
      const { data: marks, error } = await db
        .from("marks")
        .select("*")
        .in(
          "student_id",
          children.map((c) => str(c, "id")),
        )
        .eq("status", "approved");
      if (error) throw error;
      const subjects = await relatedRows(
        "exam_subjects",
        "id",
        (marks ?? []).map((m) => m.exam_subject_id),
      );
      const [exams, names] = await Promise.all([
        relatedRows(
          "exams",
          "id",
          subjects.map((s) => str(s, "exam_id")),
        ),
        schoolRows("subjects", ctx.schoolId),
      ]);
      content = (
        <>
          {children.map((child) => (
            <div key={str(child, "id")}>
              <SectionTitle>{named(child, locale)}</SectionTitle>
              {exams
                .filter((e) => e.status === "published")
                .map((e) => {
                  const rows = (marks ?? []).filter(
                    (m) =>
                      m.student_id === str(child, "id") &&
                      subjects.some(
                        (s) =>
                          str(s, "id") === m.exam_subject_id &&
                          str(s, "exam_id") === str(e, "id"),
                      ),
                  );
                  if (!rows.length) return null;
                  return (
                    <Card key={str(e, "id")} className="mb-3 p-4">
                      <h3 className="text-lg font-bold">{named(e, locale)}</h3>
                      <ul className="divide-y divide-line">
                        {rows.map((m) => {
                          const s = subjects.find(
                            (s) => str(s, "id") === m.exam_subject_id,
                          )!;
                          return (
                            <li key={m.id} className="py-3">
                              <p className="font-semibold">
                                {named(
                                  names.find(
                                    (n) =>
                                      str(n, "id") === str(s, "subject_id"),
                                  ) ?? {},
                                  locale,
                                )}
                              </p>
                              <p>
                                {m.is_absent
                                  ? L("Absent", "অনুপস্থিত")
                                  : `${m.marks_obtained} / ${str(s, "full_marks")}`}{" "}
                                ·{" "}
                                {m.is_absent ||
                                Number(m.marks_obtained) < Number(s.pass_marks)
                                  ? L("Below pass mark", "পাস নম্বরের নিচে")
                                  : L("Passed", "উত্তীর্ণ")}
                                {m.grade ? ` · ${m.grade}` : ""}
                              </p>
                            </li>
                          );
                        })}
                      </ul>
                      {rows.every((m) => m.grade_point !== null) && (
                        <p className="mt-3 font-semibold">
                          {L("Average grade point", "গড় গ্রেড পয়েন্ট")}:{" "}
                          {(
                            rows.reduce(
                              (total, m) => total + Number(m.grade_point),
                              0,
                            ) / rows.length
                          ).toFixed(2)}
                        </p>
                      )}
                    </Card>
                  );
                })}
            </div>
          ))}
          {!marks?.length && (
            <EmptyState
              icon={GraduationCap}
              title={L("No published results yet", "এখনো ফলাফল প্রকাশিত হয়নি")}
            />
          )}
        </>
      );
      break;
    }
  }
  return (
    <div>
      <PageHeader
        title={kind === "results" ? L("Results", "ফলাফল") : t.nav[kind]}
      />
      {!children.length && kind !== "profile" && (
        <Notice>
          {L(
            "No child is linked to this account. Contact the school office.",
            "এই অ্যাকাউন্টে কোনো শিক্ষার্থী যুক্ত নেই। স্কুল অফিসে যোগাযোগ করুন।",
          )}
        </Notice>
      )}
      {content}
    </div>
  );
}
