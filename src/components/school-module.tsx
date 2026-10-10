import { randomUUID } from "node:crypto";
import Link from "next/link";
import { Megaphone, Users } from "lucide-react";
import { can, requireContext } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getSectionOptions } from "@/lib/data/students";
import {
  schoolRows,
  relatedRows,
  str,
  num,
  named,
  type Row,
} from "@/lib/workflows/data";
import { permissionLabel } from "@/lib/workflows/labels";
import { schoolToday } from "@/lib/data/attendance";
import { formatTaka } from "@/lib/format";
import { Card, Notice } from "./ui";
import { Chip, EmptyState, PageHeader, SectionTitle } from "./page";
import { WorkflowForm, type FormField } from "./workflow-form";
import { TeacherPhoto } from "./teacher-photo";
import { GuardianMessage } from "./guardian-message";
import { AdminDelete } from "./admin-delete";
import { photoUrls } from "@/lib/data/photos";

export type SchoolModuleKind =
  | "classes"
  | "teachers"
  | "staff"
  | "guardians"
  | "homework"
  | "notices"
  | "exams"
  | "expenses";
export async function SchoolModule({ kind }: { kind: SchoolModuleKind }) {
  const ctx = await requireContext();
  const [{ locale, t }, sections, today, db] = await Promise.all([
    getT(),
    getSectionOptions(ctx.schoolId),
    schoolToday(ctx.schoolId),
    supabaseServer(),
  ]);
  const L = (en: string, bn: string) => (locale === "bn" ? bn : en);
  const removalAdmin = ctx.role === "admin" || ctx.role === "super_admin";
  const removalTable = { classes: "timetable_entries", teachers: "staff", staff: "", guardians: "guardians", homework: "homework", notices: "notices", exams: "exams", expenses: "expenses" }[kind];
  if (ctx.role === "guardian" && kind !== "notices")
    return <Notice tone="warn">{t.common.permissionDenied}</Notice>;
  const title = t.nav[kind];
  const form = (
    operation: string,
    fields: FormField[],
    hidden: Record<string, string> = {},
    submit?: string,
  ) => (
    <WorkflowForm
      locale={locale}
      operation={operation}
      fields={fields}
      hidden={{ id: randomUUID(), ...hidden }}
      submit={submit}
    />
  );
  const field = (
    name: string,
    en: string,
    bn: string,
    type?: string,
    required = true,
    value?: string,
  ): FormField => ({ name, label: L(en, bn), type, required, value });
  const options = (
    name: string,
    en: string,
    bn: string,
    rows: Row[],
    value?: string,
    required = true,
  ): FormField => ({
    name,
    label: L(en, bn),
    options: rows.map((r) => ({
      value: str(r, "id"),
      label: named(r, locale),
    })),
    required,
    value,
  });
  const sectionField = (allowed = sections): FormField => ({
    name: "section_id",
    label: L("Class / section", "শ্রেণি / শাখা"),
    required: true,
    options: allowed.map((s) => ({
      value: s.id,
      label: `${locale === "bn" ? s.class_name_bn : s.class_name_en} (${s.name})`,
    })),
  });
  const nameFields = [
    field("name_en", "Name in English", "ইংরেজিতে নাম"),
    field("name_bn", "Name in Bangla", "বাংলায় নাম"),
  ];
  const list = (rows: Row[], render: (r: Row) => React.ReactNode, table = removalTable) =>
    rows.length ? (
      <div className="space-y-3">
        {rows.map((r) => (
          <Card key={str(r, "id")} className="p-4">
            {render(r)}
            {removalAdmin && table && <AdminDelete table={table} id={str(r, "id")} name={named(r, locale) || str(r, "title") || str(r, "description") || L("Selected record", "নির্বাচিত রেকর্ড")} />}
          </Card>
        ))}
      </div>
    ) : (
      <EmptyState
        icon={kind === "notices" ? Megaphone : Users}
        title={L("No records yet", "এখনো কোনো রেকর্ড নেই")}
      />
    );
  const details = (label: string, content: React.ReactNode) => (
    <details className="mt-3">
      <summary className="cursor-pointer py-2 font-semibold text-brand">
        {label}
      </summary>
      <div className="mt-2">{content}</div>
    </details>
  );
  let content: React.ReactNode;
  switch (kind) {
    case "classes": {
      if (!can(ctx, "academics.manage") && ctx.role !== "teacher")
        return <Notice tone="warn">{t.common.permissionDenied}</Notice>;
      const [
        classes,
        subjects,
        assignments,
        staff,
        periods,
        timetable,
        events,
        sectionRecords,
      ] = await Promise.all([
        schoolRows("classes", ctx.schoolId, "sort_order"),
        schoolRows("subjects", ctx.schoolId, "name_en"),
        schoolRows("teacher_assignments", ctx.schoolId),
        schoolRows("staff", ctx.schoolId),
        schoolRows("periods", ctx.schoolId, "sort_order"),
        schoolRows("timetable_entries", ctx.schoolId, "weekday"),
        schoolRows("calendar_events", ctx.schoolId, "starts_on"),
        schoolRows("sections",ctx.schoolId),
      ]);
      const manager = can(ctx, "academics.manage");
      const visibleSections =
        ctx.role === "teacher" && !manager
          ? sections.filter((s) => ctx.teachesSections.includes(s.id))
          : sections;
      content = (
        <>
          {visibleSections.map((s) => (
            <Card key={s.id} className="mb-3 p-4">
              <h2 className="text-lg font-bold">
                {locale === "bn" ? s.class_name_bn : s.class_name_en} ({s.name})
              </h2>
              <p className="text-sm text-ink-2">
                {assignments
                  .filter((a) => str(a, "section_id") === s.id)
                  .map((a) =>
                    named(
                      staff.find(
                        (st) => str(st, "id") === str(a, "staff_id"),
                      ) ?? {},
                      locale,
                    ),
                  )
                  .filter(Boolean)
                  .join(" · ") ||
                  L("No teacher assigned", "শিক্ষক নির্ধারিত নেই")}
              </p>
              <Link
                className="mt-2 inline-block font-semibold text-brand"
                href={`/attendance?section=${s.id}`}
              >
                {L("Open attendance", "হাজিরা খুলুন")}
              </Link>
              {removalAdmin && <AdminDelete table="sections" id={s.id} name={`${locale === "bn" ? s.class_name_bn : s.class_name_en} (${s.name})`} />}
              {manager &&
                details(
                  L("Edit section", "শাখা সম্পাদনা"),
                  form(
                    "edit_section",
                    [
                      field(
                        "name",
                        "Section name",
                        "শাখার নাম",
                        "text",
                        true,
                        s.name,
                      ),
                      field("room", "Room", "কক্ষ", "text", false, str(sectionRecords.find(r=>str(r,"id")===s.id)??{},"room")),
                    ],
                    { id: s.id },
                  ),
                )}
            </Card>
          ))}
          <SectionTitle>{L("Subjects", "বিষয়")}</SectionTitle>
          <Card className="p-4">
            {subjects.map((s) => (
              <div key={str(s, "id")} className="py-1">
                {named(s, locale)}
                {removalAdmin && <AdminDelete table="subjects" id={str(s, "id")} name={named(s, locale)} />}
              </div>
            ))}
          </Card>
          {manager && (
            <Card className="mt-4 p-4">
              {details(
                L("Add class", "শ্রেণি যোগ করুন"),
                form("class", [
                  ...nameFields,
                  field(
                    "sort_order",
                    "Display order",
                    "প্রদর্শনের ক্রম",
                    "number",
                    true,
                    "10",
                  ),
                ]),
              )}
              {details(
                L("Edit class names", "শ্রেণির নাম সম্পাদনা"),
                classes.map((c) => (
                  <div key={str(c, "id")} className="my-3">
                    {form(
                      "edit_class",
                      nameFields.map((f) => ({ ...f, value: str(c, f.name) })),
                      { id: str(c, "id") },
                    )}
                    {removalAdmin && <AdminDelete table="classes" id={str(c, "id")} name={named(c, locale)} />}
                  </div>
                )),
              )}
              {details(
                L("Add section", "শাখা যোগ করুন"),
                form("section", [
                  options("class_id", "Class", "শ্রেণি", classes),
                  field("name", "Section name", "শাখার নাম"),
                  field("room", "Room", "কক্ষ", "text", false),
                ]),
              )}
              {details(
                L("Add subject", "বিষয় যোগ করুন"),
                form("subject", [
                  ...nameFields,
                  field("code", "Subject code", "বিষয়ের কোড", "text", false),
                ]),
              )}
              {details(
                L("Add lesson period", "পিরিয়ড যোগ করুন"),
                form("period", [
                  field("name", "Period name", "পিরিয়ডের নাম"),
                  field("starts_at", "Start time", "শুরুর সময়", "time"),
                  field("ends_at", "End time", "শেষ সময়", "time"),
                  field("sort_order", "Order", "ক্রম", "number", true, "1"),
                ]),
              )}
              {removalAdmin && details(L("Manage lesson periods", "পিরিয়ড ব্যবস্থাপনা"), periods.map(p => <div key={str(p,"id")} className="my-3"><p>{named(p,locale)} · {str(p,"starts_at")}–{str(p,"ends_at")}</p><AdminDelete table="periods" id={str(p,"id")} name={named(p,locale)} /></div>))}
              {details(
                L("Add timetable lesson", "রুটিনে পাঠ যোগ করুন"),
                form("timetable", [
                  sectionField(),
                  options("subject_id", "Subject", "বিষয়", subjects),
                  options("staff_id", "Teacher", "শিক্ষক", staff),
                  options("period_id", "Period", "পিরিয়ড", periods),
                  {
                    name: "weekday",
                    label: L("Day", "দিন"),
                    required: true,
                    options: [
                      "Sunday|রবিবার",
                      "Monday|সোমবার",
                      "Tuesday|মঙ্গলবার",
                      "Wednesday|বুধবার",
                      "Thursday|বৃহস্পতিবার",
                      "Friday|শুক্রবার",
                      "Saturday|শনিবার",
                    ].map((d, i) => ({
                      value: String(i),
                      label: d.split("|")[locale === "bn" ? 1 : 0],
                    })),
                  },
                  field("room", "Room", "কক্ষ", "text", false),
                ]),
              )}
              {details(
                L("Add calendar event", "ক্যালেন্ডারে ইভেন্ট যোগ করুন"),
                form("calendar", [
                  ...nameFields,
                  {
                    name: "kind",
                    label: L("Type", "ধরন"),
                    required: true,
                    options: [
                      { value: "holiday", label: L("Holiday", "ছুটি") },
                      { value: "exam", label: L("Exam", "পরীক্ষা") },
                      { value: "event", label: L("Event", "অনুষ্ঠান") },
                      { value: "deadline", label: L("Deadline", "শেষ তারিখ") },
                    ],
                  },
                  field("starts_on", "Starts", "শুরু", "date", true, today),
                  field("ends_on", "Ends", "শেষ", "date", true, today),
                ]),
              )}
            </Card>
          )}
          <SectionTitle>{L("Timetable", "রুটিন")}</SectionTitle>
          {list(
            timetable.filter((r) =>
              visibleSections.some((s) => s.id === str(r, "section_id")),
            ),
            (r) => (
              <>
                <p className="font-semibold">
                  {
                    sections.find((s) => s.id === str(r, "section_id"))?.[
                      locale === "bn" ? "class_name_bn" : "class_name_en"
                    ]
                  }{" "}
                  ·{" "}
                  {L(
                    [
                      "Sunday",
                      "Monday",
                      "Tuesday",
                      "Wednesday",
                      "Thursday",
                      "Friday",
                      "Saturday",
                    ][num(r, "weekday")],
                    [
                      "রবিবার",
                      "সোমবার",
                      "মঙ্গলবার",
                      "বুধবার",
                      "বৃহস্পতিবার",
                      "শুক্রবার",
                      "শনিবার",
                    ][num(r, "weekday")],
                  )}{" "}
                  ·{" "}
                  {named(
                    subjects.find(
                      (s) => str(s, "id") === str(r, "subject_id"),
                    ) ?? {},
                    locale,
                  )}
                </p>
                <p className="text-sm">
                  {named(
                    periods.find((s) => str(s, "id") === str(r, "period_id")) ??
                      {},
                    locale,
                  )}{" "}
                  ·{" "}
                  {named(
                    staff.find((s) => str(s, "id") === str(r, "staff_id")) ??
                      {},
                    locale,
                  )}
                </p>
              </>
            ),
          )}
          <SectionTitle>
            {L("School calendar", "স্কুল ক্যালেন্ডার")}
          </SectionTitle>
          {list(events, (r) => (
            <>
              <p className="font-semibold">
                {str(r, locale === "bn" ? "title_bn" : "title_en") ||
                  str(r, "title_en")}
              </p>
              <p>
                {str(r, "starts_on")} — {str(r, "ends_on")}
              </p>
            </>
          ), "calendar_events")}
        </>
      );
      break;
    }
    case "teachers": {
      if (!can(ctx, "teachers.manage"))
        return <Notice tone="warn">{t.common.permissionDenied}</Notice>;
      const [staff, subjects, assignments, years] = await Promise.all([
        schoolRows("staff", ctx.schoolId, "full_name_en"),
        schoolRows("subjects", ctx.schoolId, "name_en"),
        schoolRows("teacher_assignments", ctx.schoolId),
        schoolRows("academic_years", ctx.schoolId),
      ]);
      const currentYear = years.find((y) => y.is_current);
      const photos = await photoUrls(staff.map((r) => str(r, "photo_path")), "teacher-photos");
      content = (
        <>
          <Card className="mb-4 p-4">
            <p className="mb-3 text-sm text-ink-2">{L("Save the teacher's details first, then use Add photo on their card. JPG, PNG or WebP; photos are reduced for fast uploads.", "আগে শিক্ষকের তথ্য সংরক্ষণ করুন, তারপর তার কার্ডে ছবি যোগ করুন। JPG, PNG বা WebP; দ্রুত আপলোডের জন্য ছবি ছোট করা হয়।")}</p>
            {details(
              L("Add staff / teacher", "কর্মী / শিক্ষক যোগ করুন"),
              form("staff", [
                ...nameFields,
                field("designation", "Designation", "পদবি", "text", false),
                field("email", "Email", "ইমেইল", "email", false),
                field("phone", "Phone", "ফোন", "tel", false),
                field(
                  "joining_date",
                  "Joining date",
                  "যোগদানের তারিখ",
                  "date",
                  false,
                  today,
                ),
              ]),
            )}
          </Card>
          {list(staff, (r) => (
            <>
              <TeacherPhoto staffId={str(r, "id")} schoolId={ctx.schoolId} name={named(r, locale)} src={photos[str(r, "photo_path")] ?? null} />
              <h2 className="text-lg font-bold">{named(r, locale)}</h2>
              <p className="text-sm text-ink-2">
                {str(r, "staff_code")} · {str(r, "designation")} ·{" "}
                {str(r, "phone")}
              </p>
              <Chip>
                {L(
                  str(r, "status"),
                  (
                    {
                      active: "সক্রিয়",
                      on_leave: "ছুটিতে",
                      resigned: "পদত্যাগ",
                    } as Record<string, string>
                  )[str(r, "status")] ?? str(r, "status"),
                )}
              </Chip>
              <ul className="mt-3 space-y-2">
                {assignments
                  .filter(
                    (a) =>
                      str(a, "staff_id") === str(r, "id") &&
                      str(a, "academic_year_id") ===
                        str(currentYear ?? {}, "id"),
                  )
                  .map((a) => (
                    <li
                      key={str(a, "id")}
                      className="rounded-xl bg-surface-2 p-3"
                    >
                      {
                        sections.find((s) => s.id === str(a, "section_id"))?.[
                          locale === "bn" ? "class_name_bn" : "class_name_en"
                        ]
                      }{" "}
                      ·{" "}
                      {named(
                        subjects.find(
                          (s) => str(s, "id") === str(a, "subject_id"),
                        ) ?? {},
                        locale,
                      ) || L("All subjects", "সব বিষয়")}
                      {removalAdmin && <AdminDelete table="teacher_assignments" id={str(a,"id")} name={L("Teacher assignment", "শিক্ষকের দায়িত্ব")} />}
                    </li>
                  ))}
              </ul>
              {details(
                L("Assign class / subject", "শ্রেণি / বিষয়ের দায়িত্ব দিন"),
                form(
                  "assignment",
                  [
                    sectionField(),
                    options(
                      "subject_id",
                      "Subject (optional)",
                      "বিষয় (ঐচ্ছিক)",
                      subjects,
                      undefined,
                      false,
                    ),
                    {
                      name: "is_class_teacher",
                      label: L("Class teacher", "শ্রেণি শিক্ষক"),
                      value: "false",
                      options: [
                        { value: "false", label: L("No", "না") },
                        { value: "true", label: L("Yes", "হ্যাঁ") },
                      ],
                    },
                  ],
                  { staff_id: str(r, "id") },
                ),
              )}
              {details(
                L("Edit details", "তথ্য সম্পাদনা"),
                form(
                  "edit_staff",
                  [
                    ...nameFields.map((f) => ({
                      ...f,
                      required: f.name !== "name_bn",
                      value: str(r, f.name.replace("name_", "full_name_")),
                    })),
                    field(
                      "designation",
                      "Designation",
                      "পদবি",
                      "text",
                      false,
                      str(r, "designation"),
                    ),
                    field(
                      "phone",
                      "Phone",
                      "ফোন",
                      "tel",
                      false,
                      str(r, "phone"),
                    ),
                    field(
                      "email",
                      "Email",
                      "ইমেইল",
                      "email",
                      false,
                      str(r, "email"),
                    ),
                  ],
                  { id: str(r, "id") },
                ),
              )}
              {details(
                L("Change staff status", "কর্মীর অবস্থা পরিবর্তন"),
                form(
                  "staff_status",
                  [
                    {
                      name: "status",
                      label: L("Status", "অবস্থা"),
                      value: str(r, "status"),
                      options: [
                        { value: "active", label: L("Active", "সক্রিয়") },
                        { value: "on_leave", label: L("On leave", "ছুটিতে") },
                        ...(removalAdmin ? [{ value: "resigned", label: L("Resigned", "পদত্যাগ") }] : []),
                      ],
                    },
                  ],
                  { id: str(r, "id") },
                ),
              )}
              {ctx.role === "super_admin" &&
                !r.profile_id &&
                details(
                  L("Create sign-in invitation", "সাইন ইন আমন্ত্রণ তৈরি"),
                  form(
                    "invitation",
                    [
                      field(
                        "email",
                        "Invitation email",
                        "আমন্ত্রণের ইমেইল",
                        "email",
                        true,
                        str(r, "email"),
                      ),
                      {
                        name: "role",
                        label: L("Role", "ভূমিকা"),
                        value: "teacher",
                        options: [
                          { value: "teacher", label: t.roles.teacher },
                          { value: "admin", label: t.roles.admin },
                          { value: "accountant", label: t.roles.accountant },
                        ],
                      },
                    ],
                    { staff_id: str(r, "id") },
                  ),
                )}
            </>
          ))}
        </>
      );
      break;
    }
    case "staff": {
      if (!can(ctx, "staff.manage"))
        return <Notice tone="warn">{t.common.permissionDenied}</Notice>;
      const [members, invitations] = await Promise.all([
        schoolRows("school_members", ctx.schoolId),
        schoolRows("invitations", ctx.schoolId, "created_at", false),
      ]);
      const [
        { data: profiles, error: profileError },
        { data: permissions, error: permError },
        overrides,
        defaults,
      ] = await Promise.all([
        db
          .from("profiles")
          .select("id,full_name,email")
          .in(
            "id",
            members.map((m) => str(m, "user_id")),
          ),
        db.from("permissions").select("key,description,module").order("key"),
        relatedRows(
          "member_permission_overrides",
          "member_id",
          members.map((m) => str(m, "id")),
        ),
        db.from("role_permissions").select("role_key,permission_key"),
      ]);
      if (profileError || permError || defaults.error)
        throw profileError || permError || defaults.error;
      const owner = ctx.role === "super_admin";
      content = (
        <>
          {owner && (
            <Card className="mb-4 p-4">
              {details(
                L("Create staff invitation", "কর্মীর আমন্ত্রণ তৈরি"),
                form("invitation", [
                  field("email", "Email", "ইমেইল", "email"),
                  {
                    name: "role",
                    label: L("Role", "ভূমিকা"),
                    required: true,
                    value: "admin",
                    options: ["admin", "accountant", "teacher"].map((v) => ({
                      value: v,
                      label: t.roles[v as "admin"],
                    })),
                  },
                ]),
              )}
            </Card>
          )}
          {list(members, (r) => {
            const p = ((profiles as Row[]) ?? []).find(
              (p) => str(p, "id") === str(r, "user_id"),
            );
            const role = str(r, "role_key");
            return (
              <>
                <h2 className="font-bold">
                  {str(p ?? {}, "full_name") ||
                    str(p ?? {}, "email") ||
                    str(r, "user_id")}
                </h2>
                <p className="break-all text-sm text-ink-2">
                  {str(p ?? {}, "email")}
                </p>
                <p>
                  {t.roles[role as keyof typeof t.roles]} ·{" "}
                  {L(
                    str(r, "status"),
                    str(r, "status") === "active" ? "সক্রিয়" : "স্থগিত",
                  )}
                </p>
                {owner && role !== "super_admin" && (
                  <>
                    {details(
                      L("Role and access status", "ভূমিকা ও প্রবেশের অবস্থা"),
                      form(
                        "membership",
                        [
                          {
                            name: "role",
                            label: L("Role", "ভূমিকা"),
                            value: role,
                            options: (role === "guardian"
                              ? ["guardian"]
                              : ["admin", "accountant", "teacher"]
                            ).map((v) => ({
                              value: v,
                              label: t.roles[v as keyof typeof t.roles],
                            })),
                          },
                          {
                            name: "status",
                            label: L("Status", "অবস্থা"),
                            value: str(r, "status"),
                            options: [
                              {
                                value: "active",
                                label: L("Active", "সক্রিয়"),
                              },
                              {
                                value: "suspended",
                                label: L("Suspended", "স্থগিত"),
                              },
                            ],
                          },
                        ],
                        { member_id: str(r, "id") },
                      ),
                    )}
                    {role !== "guardian" &&
                      details(
                        L("Permissions", "অনুমতি"),
                        <>
                          <p className="mb-3 text-sm text-ink-2">
                            {L(
                              "Default follows the role. Grant or deny overrides it for this person.",
                              "ডিফল্ট ভূমিকার অনুমতি অনুসরণ করে। অনুমোদন বা নিষেধ এই ব্যক্তির জন্য সেটি পরিবর্তন করে।",
                            )}
                          </p>
                          {((permissions as Row[]) ?? []).map((p) => {
                            const key = str(p, "key");
                            const override = overrides.find(
                              (o) =>
                                str(o, "member_id") === str(r, "id") &&
                                str(o, "permission_key") === key,
                            );
                            const granted = override
                              ? Boolean(override.granted)
                              : (defaults.data ?? []).some(
                                  (d) =>
                                    d.role_key === role &&
                                    d.permission_key === key,
                                );
                            return (
                              <div
                                key={key}
                                className="my-3 rounded-xl bg-surface-2 p-3"
                              >
                                <p className="mb-2 text-sm">
                                  {permissionLabel(
                                    key,
                                    str(p, "description"),
                                    locale,
                                  )}{" "}
                                  ·{" "}
                                  {granted
                                    ? L("Allowed", "অনুমোদিত")
                                    : L("Denied", "নিষিদ্ধ")}
                                </p>
                                {form(
                                  "permission",
                                  [
                                    {
                                      name: "mode",
                                      label: L("Permission", "অনুমতি"),
                                      value: override
                                        ? override.granted
                                          ? "grant"
                                          : "deny"
                                        : "default",
                                      options: [
                                        {
                                          value: "default",
                                          label: L(
                                            "Role default",
                                            "ভূমিকার ডিফল্ট",
                                          ),
                                        },
                                        {
                                          value: "grant",
                                          label: L("Grant", "অনুমোদন"),
                                        },
                                        {
                                          value: "deny",
                                          label: L("Deny", "নিষেধ"),
                                        },
                                      ],
                                    },
                                  ],
                                  { member_id: str(r, "id"), permission: key },
                                )}
                              </div>
                            );
                          })}
                        </>,
                      )}
                  </>
                )}
              </>
            );
          })}
          <SectionTitle>{L("Invitations", "আমন্ত্রণ")}</SectionTitle>
          {list(invitations.filter((r) => !r.revoked_at), (r) => (
            <>
              <p className="break-all font-semibold">{str(r, "email")}</p>
              <p className="text-sm">
                {t.roles[str(r, "role_key") as keyof typeof t.roles]} ·{" "}
                {r.accepted_at
                  ? L("Accepted", "গ্রহণ করা হয়েছে")
                  : r.revoked_at
                    ? L("Revoked", "বাতিল")
                    : L("Pending", "অপেক্ষমান")}{" "}
                · {str(r, "expires_at").slice(0, 10)}
              </p>
              {!r.accepted_at &&
                !r.revoked_at &&
                owner &&
                details(
                  L("Revoke invitation", "আমন্ত্রণ বাতিল"),
                  form("revoke_invitation", [], { id: str(r, "id") }),
                )}
            </>
          ))}
        </>
      );
      break;
    }
    case "guardians": {
      if (!can(ctx, "guardians.manage"))
        return <Notice tone="warn">{t.common.permissionDenied}</Notice>;
      const guardians = await schoolRows(
        "guardians",
        ctx.schoolId,
        "full_name",
      );
      const links = await relatedRows(
        "student_guardians",
        "guardian_id",
        guardians.map((g) => str(g, "id")),
      );
      const children = await relatedRows(
        "students",
        "id",
        links.map((l) => str(l, "student_id")),
      );
      content = list(guardians, (r) => (
        <>
          <h2 className="font-bold">{str(r, "full_name")}</h2>
          <p className="text-sm">
            {str(r, "phone")} · {str(r, "email")}
          </p>
          <GuardianMessage name={str(r, "full_name")} phone={str(r, "phone")} />
          <p className="mt-2 text-sm text-ink-2">
            {links
              .filter((l) => str(l, "guardian_id") === str(r, "id"))
              .map((l) =>
                named(
                  children.find((c) => str(c, "id") === str(l, "student_id")) ??
                    {},
                  locale,
                ),
              )
              .filter(Boolean)
              .join(" · ")}
          </p>
          {r.profile_id ? (
            <Chip tint="green">
              {L("Parent account linked", "অভিভাবকের অ্যাকাউন্ট যুক্ত")}
            </Chip>
          ) : (
            details(
              L("Invite parent", "অভিভাবককে আমন্ত্রণ"),
              form(
                "invitation",
                [
                  field(
                    "email",
                    "Parent's email",
                    "অভিভাবকের ইমেইল",
                    "email",
                    true,
                    str(r, "email"),
                  ),
                ],
                { role: "guardian", guardian_id: str(r, "id") },
              ),
            )
          )}
        </>
      ));
      break;
    }
    case "homework": {
      if (!can(ctx, "homework.manage") && ctx.role !== "teacher")
        return <Notice tone="warn">{t.common.permissionDenied}</Notice>;
      const [homework, subjects] = await Promise.all([
        schoolRows("homework", ctx.schoolId, "created_at", false),
        schoolRows("subjects", ctx.schoolId, "name_en"),
      ]);
      const allowed = can(ctx, "homework.manage")
        ? sections
        : sections.filter((s) => ctx.teachesSections.includes(s.id));
      content = (
        <>
          <Card className="mb-4 p-4">
            {details(
              L("Add homework", "বাড়ির কাজ যোগ করুন"),
              form("homework", [
                sectionField(allowed),
                options(
                  "subject_id",
                  "Subject (optional)",
                  "বিষয় (ঐচ্ছিক)",
                  subjects,
                  undefined,
                  false,
                ),
                field("title", "Title", "শিরোনাম"),
                field(
                  "instructions",
                  "Instructions",
                  "নির্দেশনা",
                  "textarea",
                  false,
                ),
                field("due_on", "Due date", "শেষ তারিখ", "date", false, today),
                {
                  name: "status",
                  label: L("Status", "অবস্থা"),
                  value: "published",
                  options: [
                    {
                      value: "published",
                      label: L("Publish now", "এখন প্রকাশ করুন"),
                    },
                    { value: "draft", label: L("Draft", "খসড়া") },
                  ],
                },
              ]),
            )}
          </Card>
          {list(homework, (r) => (
            <>
              <Link
                href={`/homework/${str(r, "id")}`}
                className="text-lg font-bold text-brand"
              >
                {str(r, "title")}
              </Link>
              <p className="mt-1 text-sm text-ink-2">
                {
                  sections.find((s) => s.id === str(r, "section_id"))?.[
                    locale === "bn" ? "class_name_bn" : "class_name_en"
                  ]
                }{" "}
                · {str(r, "due_on")}
              </p>
              <p className="mt-2 whitespace-pre-wrap break-words">
                {str(r, "instructions")}
              </p>
              <Chip>
                {L(
                  str(r, "status"),
                  (
                    {
                      published: "প্রকাশিত",
                      draft: "খসড়া",
                      archived: "সংরক্ষিত",
                    } as Record<string, string>
                  )[str(r, "status")] ?? "",
                )}
              </Chip>
              {details(
                L("Change publication status", "প্রকাশের অবস্থা পরিবর্তন"),
                form(
                  "homework_status",
                  [
                    {
                      name: "status",
                      label: L("Status", "অবস্থা"),
                      value: str(r, "status"),
                      options: [
                        { value: "draft", label: L("Draft", "খসড়া") },
                        {
                          value: "published",
                          label: L("Published", "প্রকাশিত"),
                        },
                        ...(removalAdmin ? [{ value: "archived", label: L("Archived", "সংরক্ষিত") }] : []),
                      ],
                    },
                  ],
                  { id: str(r, "id") },
                ),
              )}
            </>
          ))}
        </>
      );
      break;
    }
    case "notices": {
      const notices = await schoolRows(
        "notices",
        ctx.schoolId,
        "created_at",
        false,
      );
      const manager = can(ctx, "notices.manage"),
        teacher = ctx.role === "teacher";
      content = (
        <>
          {(manager || teacher) && (
            <Card className="mb-4 p-4">
              {details(
                L("Publish notice", "নোটিশ প্রকাশ"),
                form("notice", [
                  field("title", "Title", "শিরোনাম"),
                  field("body", "Notice text", "নোটিশের লেখা", "textarea"),
                  {
                    name: "audience",
                    label: L("Audience", "কার জন্য"),
                    value: manager ? "all" : "sections",
                    options: (manager
                      ? [
                          { value: "all", label: L("Everyone", "সবার জন্য") },
                          {
                            value: "staff",
                            label: L("Staff", "কর্মীদের জন্য"),
                          },
                          {
                            value: "guardians",
                            label: L("Parents", "অভিভাবকদের জন্য"),
                          },
                        ]
                      : []
                    ).concat({
                      value: "sections",
                      label: L("One section", "একটি শাখা"),
                    }),
                  },
                  {
                    ...sectionField(
                      manager
                        ? sections
                        : sections.filter((s) =>
                            ctx.teachesSections.includes(s.id),
                          ),
                    ),
                    required: false,
                  },
                ]),
              )}
            </Card>
          )}
          {list(notices, (r) => (
            <>
              <Link
                className="text-lg font-bold text-brand"
                href={`/notices/${str(r, "id")}`}
              >
                {str(r, "title")}
              </Link>
              <p className="text-xs text-ink-2">
                {str(r, "created_at").slice(0, 10)}
              </p>
              <p className="mt-2 whitespace-pre-wrap break-words">
                {str(r, "body")}
              </p>
              {!r.is_published && (
                <Chip>{L("Withdrawn", "প্রত্যাহার করা হয়েছে")}</Chip>
              )}
              {manager && removalAdmin &&
                r.is_published &&
                details(
                  L("Withdraw notice", "নোটিশ প্রত্যাহার"),
                  form("withdraw_notice", [], { id: str(r, "id") }),
                )}
            </>
          ))}
        </>
      );
      break;
    }
    case "exams": {
      if (
        !can(ctx, "exams.manage") &&
        !can(ctx, "marks.enter") &&
        !can(ctx, "results.publish") &&
        ctx.role !== "teacher"
      )
        return <Notice tone="warn">{t.common.permissionDenied}</Notice>;
      const [exams, scales] = await Promise.all([
        schoolRows("exams", ctx.schoolId, "starts_on", false),
        schoolRows("grade_scales", ctx.schoolId),
      ]);
      const bands = await relatedRows(
        "grade_bands",
        "scale_id",
        scales.map((s) => str(s, "id")),
      );
      content = (
        <>
          {can(ctx, "exams.manage") && (
            <Card className="mb-4 p-4">
              {details(
                L("Create exam", "পরীক্ষা তৈরি"),
                form("exam", [
                  ...nameFields.map((f) => ({
                    ...f,
                    required: f.name === "name_en",
                  })),
                  {
                    name: "kind",
                    label: L("Exam type", "পরীক্ষার ধরন"),
                    value: "class_test",
                    options: [
                      {
                        value: "class_test",
                        label: L("Class test", "শ্রেণি পরীক্ষা"),
                      },
                      { value: "monthly", label: L("Monthly", "মাসিক") },
                      {
                        value: "half_yearly",
                        label: L("Half yearly", "অর্ধবার্ষিক"),
                      },
                      { value: "annual", label: L("Annual", "বার্ষিক") },
                      { value: "custom", label: L("Other", "অন্যান্য") },
                    ],
                  },
                  field("starts_on", "Starts", "শুরু", "date", true, today),
                  field("ends_on", "Ends", "শেষ", "date", true, today),
                  {
                    name: "grade_scale_id",
                    label: L("Grade scale (optional)", "গ্রেড স্কেল (ঐচ্ছিক)"),
                    options: scales.map((s) => ({
                      value: str(s, "id"),
                      label: str(s, "name"),
                    })),
                  },
                ]),
              )}
            </Card>
          )}
          {list(exams, (r) => (
            <Link href={`/exams/${str(r, "id")}`} className="block">
              <h2 className="text-lg font-bold">{named(r, locale)}</h2>
              <p className="text-sm text-ink-2">
                {str(r, "starts_on")} — {str(r, "ends_on")}
              </p>
              <Chip tint={r.status === "published" ? "green" : "blue"}>
                {L(
                  str(r, "status"),
                  r.status === "published" ? "প্রকাশিত" : "নম্বর প্রদান",
                )}
              </Chip>
            </Link>
          ))}
          {can(ctx, "exams.manage") && (
            <Card className="mt-4 p-4">
              {details(
                L("Grading scales", "গ্রেড স্কেল"),
                <>
                  {form("grade_scale", [
                    field("name", "New scale name", "নতুন স্কেলের নাম"),
                  ])}
                  {scales.map((scale) => (
                    <section key={str(scale, "id")}>
                      <SectionTitle>{str(scale, "name")}</SectionTitle>
                      {bands
                        .filter((b) => str(b, "scale_id") === str(scale, "id"))
                        .sort(
                          (a, b) =>
                            num(b, "min_percent") - num(a, "min_percent"),
                        )
                        .map((b) => (
                          <p key={str(b, "id")} className="py-1 text-sm">
                            {str(b, "min_percent")}–{str(b, "max_percent")}% ·{" "}
                            {str(b, "grade")} · {str(b, "grade_point")}
                          </p>
                        ))}
                      {details(
                        L("Add grade band", "গ্রেড সীমা যোগ করুন"),
                        form(
                          "grade_band",
                          [
                            field(
                              "min_percent",
                              "Minimum %",
                              "সর্বনিম্ন %",
                              "number",
                            ),
                            field(
                              "max_percent",
                              "Maximum %",
                              "সর্বোচ্চ %",
                              "number",
                            ),
                            field("grade", "Grade", "গ্রেড"),
                            field(
                              "grade_point",
                              "Grade point",
                              "গ্রেড পয়েন্ট",
                              "number",
                            ),
                          ].map((f) =>
                            f.type === "number" ? { ...f, step: "0.01" } : f,
                          ),
                          { scale_id: str(scale, "id") },
                        ),
                      )}
                    </section>
                  ))}
                </>,
              )}
            </Card>
          )}
        </>
      );
      break;
    }
    case "expenses": {
      if (
        !can(ctx, "expenses.view") &&
        !can(ctx, "expenses.create") &&
        !can(ctx, "expenses.approve")
      )
        return <Notice tone="warn">{t.common.permissionDenied}</Notice>;
      const [expenses, categories] = await Promise.all([
        schoolRows("expenses", ctx.schoolId, "spent_on", false),
        schoolRows("expense_categories", ctx.schoolId, "name_en"),
      ]);
      content = (
        <>
          {can(ctx, "expenses.create") && (
            <Card className="mb-4 p-4">
              {details(
                L("Record expense", "ব্যয় লিখুন"),
                form("expense", [
                  options(
                    "category_id",
                    "Category",
                    "খাত",
                    categories.filter((c) => c.is_active),
                  ),
                  field("amount", "Amount (৳)", "পরিমাণ (৳)"),
                  field("description", "Description", "বিবরণ", "textarea"),
                  field("spent_on", "Date", "তারিখ", "date", true, today),
                  {
                    name: "method",
                    label: L("Method", "মাধ্যম"),
                    value: "cash",
                    options: [
                      "cash",
                      "bank",
                      "bkash",
                      "nagad",
                      "rocket",
                      "other",
                    ].map((v) => ({
                      value: v,
                      label:
                        t.fees.methods[v as keyof typeof t.fees.methods] ||
                        L("Other", "অন্যান্য"),
                    })),
                  },
                  field("vendor", "Vendor", "বিক্রেতা", "text", false),
                ]),
              )}
            </Card>
          )}
          {can(ctx, "expenses.approve") && (
            <Card className="mb-4 p-4">
              {details(
                L("Add expense category", "ব্যয়ের খাত যোগ করুন"),
                form("expense_category", nameFields),
              )}
            </Card>
          )}
          <Notice>
            {L(
              "New expenses stay pending until approved. Rejected expenses are retained for the audit trail.",
              "নতুন ব্যয় অনুমোদন না হওয়া পর্যন্ত অপেক্ষমান থাকে। প্রত্যাখ্যাত ব্যয়ও রেকর্ডে থাকে।",
            )}
          </Notice>
          <div className="mt-4">
            {list(expenses, (r) => (
              <>
                <h2 className="font-bold">{str(r, "description")}</h2>
                <p className="my-1 text-lg font-bold">
                  {formatTaka(str(r, "amount"))}
                </p>
                <p className="text-sm text-ink-2">
                  {str(r, "spent_on")} ·{" "}
                  {named(
                    categories.find(
                      (c) => str(c, "id") === str(r, "category_id"),
                    ) ?? {},
                    locale,
                  )}{" "}
                  · {str(r, "vendor")}
                </p>
                <Chip
                  tint={
                    r.status === "approved"
                      ? "green"
                      : r.status === "rejected"
                        ? "rose"
                        : "amber"
                  }
                >
                  {L(
                    str(r, "status"),
                    (
                      {
                        pending: "অপেক্ষমান",
                        approved: "অনুমোদিত",
                        rejected: "প্রত্যাখ্যাত",
                      } as Record<string, string>
                    )[str(r, "status")] ?? "",
                  )}
                </Chip>
                {r.decision_note && (
                  <p className="mt-2 text-sm">{str(r, "decision_note")}</p>
                )}
                {r.status === "pending" &&
                  can(ctx, "expenses.approve") &&
                  details(
                    L("Review expense", "ব্যয় পর্যালোচনা"),
                    form(
                      "decide_expense",
                      [
                        {
                          name: "decision",
                          label: L("Decision", "সিদ্ধান্ত"),
                          value: "approve",
                          options: [
                            {
                              value: "approve",
                              label: L("Approve", "অনুমোদন"),
                            },
                            {
                              value: "reject",
                              label: L("Reject", "প্রত্যাখ্যান"),
                            },
                          ],
                        },
                        field(
                          "note",
                          "Reason (required to reject)",
                          "কারণ (প্রত্যাখ্যানে আবশ্যক)",
                          "textarea",
                          false,
                        ),
                      ],
                      { id: str(r, "id") },
                    ),
                  )}
              </>
            ))}
          </div>
        </>
      );
      break;
    }
  }
  return (
    <div>
      <PageHeader title={title} />
      {content}
    </div>
  );
}
