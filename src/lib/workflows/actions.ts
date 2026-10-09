"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { can, requireContext } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { parseTaka } from "@/lib/format";

export type WorkflowState = {
  success?: boolean;
  error?: string;
  invitePath?: string;
};

export async function saveWorkflow(
  _state: WorkflowState,
  form: FormData,
): Promise<WorkflowState> {
  const bn = form.get("locale") !== "en";
  try {
    const ctx = await requireContext();
    const db = await supabaseServer();
    const value = (key: string) =>
      z
        .string()
        .max(10000)
        .parse(form.get(key) ?? "")
        .trim();
    const text = (key: string) => z.string().min(1).max(1000).parse(value(key));
    const uuid = (key: string) => z.uuid().parse(value(key));
    const optionalId = (key: string) => (value(key) ? uuid(key) : null);
    const date = (key: string) => z.iso.date().parse(value(key));
    const optionalDate = (key: string) => (value(key) ? date(key) : null);
    const permit = (perm: string) => {
      if (!can(ctx, perm)) throw new Error("permission_denied");
    };
    const sameSchool = async (table: string, id: string) => {
      const { data, error } = await db
        .from(table)
        .select("id")
        .eq("id", id)
        .eq("school_id", ctx.schoolId)
        .maybeSingle();
      if (error || !data) throw new Error("permission_denied");
    };
    const check = (r: { error: { message: string; code?: string } | null }) => {
      if (r.error) throw new Error(`${r.error.code}: ${r.error.message}`);
    };
    const operation = text("operation");
    const id = () => uuid("id");
    let invitePath: string | undefined;
    switch (operation) {
      case "edit_class": {
        permit("academics.manage");
        await sameSchool("classes", id());
        check(
          await db
            .from("classes")
            .update({ name_en: text("name_en"), name_bn: text("name_bn") })
            .eq("id", id())
            .eq("school_id", ctx.schoolId),
        );
        break;
      }
      case "edit_section": {
        permit("academics.manage");
        await sameSchool("sections", id());
        check(
          await db
            .from("sections")
            .update({ name: text("name"), room: value("room") || null })
            .eq("id", id())
            .eq("school_id", ctx.schoolId),
        );
        break;
      }
      case "edit_staff": {
        permit("teachers.manage");
        await sameSchool("staff", id());
        check(
          await db
            .from("staff")
            .update({
              full_name_en: text("name_en"),
              full_name_bn: value("name_bn") || null,
              designation: value("designation") || null,
              phone: value("phone") || null,
              email: value("email") ? z.email().parse(value("email")) : null,
            })
            .eq("id", id())
            .eq("school_id", ctx.schoolId),
        );
        break;
      }
      case "period": {
        permit("academics.manage");
        const time = (key: string) =>
          z
            .string()
            .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
            .parse(value(key));
        check(
          await db
            .from("periods")
            .insert({
              id: id(),
              school_id: ctx.schoolId,
              name: text("name"),
              starts_at: time("starts_at"),
              ends_at: time("ends_at"),
              sort_order: z.coerce
                .number()
                .int()
                .min(0)
                .max(999)
                .parse(value("sort_order")),
            }),
        );
        break;
      }
      case "calendar": {
        permit("academics.manage");
        const start = date("starts_on"),
          end = date("ends_on");
        if (end < start) throw new Error("invalid_input");
        check(
          await db
            .from("calendar_events")
            .insert({
              id: id(),
              school_id: ctx.schoolId,
              title_en: text("name_en"),
              title_bn: text("name_bn"),
              kind: z
                .enum(["holiday", "exam", "event", "deadline"])
                .parse(value("kind")),
              starts_on: start,
              ends_on: end,
            }),
        );
        break;
      }
      case "timetable": {
        permit("academics.manage");
        for (const [table, key] of [
          ["sections", "section_id"],
          ["subjects", "subject_id"],
          ["staff", "staff_id"],
          ["periods", "period_id"],
        ])
          await sameSchool(table, uuid(key));
        const { data: year, error } = await db
          .from("academic_years")
          .select("id")
          .eq("school_id", ctx.schoolId)
          .eq("is_current", true)
          .single();
        check({ error });
        check(
          await db
            .from("timetable_entries")
            .insert({
              id: id(),
              school_id: ctx.schoolId,
              academic_year_id: year!.id,
              section_id: uuid("section_id"),
              subject_id: uuid("subject_id"),
              staff_id: uuid("staff_id"),
              period_id: uuid("period_id"),
              weekday: z.coerce
                .number()
                .int()
                .min(0)
                .max(6)
                .parse(value("weekday")),
              room: value("room") || null,
            }),
        );
        break;
      }
      case "remove_timetable": {
        if (ctx.role !== "admin" && ctx.role !== "super_admin") throw new Error("permission_denied");
        permit("academics.manage");
        await sameSchool("timetable_entries", id());
        check(
          await db
            .from("timetable_entries")
            .delete()
            .eq("id", id())
            .eq("school_id", ctx.schoolId),
        );
        break;
      }
      case "class": {
        permit("academics.manage");
        check(
          await db
            .from("classes")
            .insert({
              id: id(),
              school_id: ctx.schoolId,
              name_en: text("name_en"),
              name_bn: text("name_bn"),
              sort_order: z.coerce
                .number()
                .int()
                .min(0)
                .max(999)
                .parse(value("sort_order")),
            }),
        );
        break;
      }
      case "section": {
        permit("academics.manage");
        await sameSchool("classes", uuid("class_id"));
        check(
          await db
            .from("sections")
            .insert({
              id: id(),
              school_id: ctx.schoolId,
              class_id: uuid("class_id"),
              name: text("name"),
              room: value("room") || null,
            }),
        );
        break;
      }
      case "subject": {
        permit("academics.manage");
        check(
          await db
            .from("subjects")
            .insert({
              id: id(),
              school_id: ctx.schoolId,
              name_en: text("name_en"),
              name_bn: text("name_bn"),
              code: value("code") || null,
            }),
        );
        break;
      }
      case "staff": {
        permit("teachers.manage");
        check(
          await db
            .from("staff")
            .insert({
              id: id(),
              school_id: ctx.schoolId,
              staff_code: "",
              full_name_en: text("name_en"),
              full_name_bn: value("name_bn") || null,
              designation: value("designation") || null,
              email: value("email") ? z.email().parse(value("email")) : null,
              phone: value("phone") || null,
              joining_date: optionalDate("joining_date"),
            }),
        );
        break;
      }
      case "staff_status": {
        permit("teachers.manage");
        await sameSchool("staff", id());
        check(
          await db
            .from("staff")
            .update({
              status: z
                .enum(["active", "on_leave", "resigned"])
                .parse(value("status")),
            })
            .eq("id", id())
            .eq("school_id", ctx.schoolId),
        );
        break;
      }
      case "assignment": {
        permit("teachers.manage");
        await sameSchool("staff", uuid("staff_id"));
        await sameSchool("sections", uuid("section_id"));
        const subject = optionalId("subject_id");
        if (subject) await sameSchool("subjects", subject);
        const { data: year, error } = await db
          .from("academic_years")
          .select("id")
          .eq("school_id", ctx.schoolId)
          .eq("is_current", true)
          .single();
        check({ error });
        check(
          await db
            .from("teacher_assignments")
            .insert({
              id: id(),
              school_id: ctx.schoolId,
              staff_id: uuid("staff_id"),
              section_id: uuid("section_id"),
              subject_id: subject,
              academic_year_id: year!.id,
              is_class_teacher: value("is_class_teacher") === "true",
            }),
        );
        break;
      }
      case "remove_assignment": {
        if (ctx.role !== "admin" && ctx.role !== "super_admin") throw new Error("permission_denied");
        permit("teachers.manage");
        await sameSchool("teacher_assignments", id());
        check(
          await db
            .from("teacher_assignments")
            .delete()
            .eq("id", id())
            .eq("school_id", ctx.schoolId),
        );
        break;
      }
      case "invitation": {
        const role = z
          .enum(["admin", "accountant", "teacher", "guardian"])
          .parse(value("role"));
        if (role === "guardian") permit("guardians.manage");
        else if (ctx.role !== "super_admin")
          throw new Error("permission_denied");
        const guardian = optionalId("guardian_id"),
          staff = optionalId("staff_id");
        if (guardian) await sameSchool("guardians", guardian);
        if (staff) await sameSchool("staff", staff);
        if (role === "guardian" && !guardian) throw new Error("invalid_input");
        const { data, error } = await db.rpc("create_invitation", {
          p_school: ctx.schoolId,
          p_email: z.email().parse(value("email")),
          p_role: role,
          p_guardian: guardian,
          p_staff: staff,
        });
        check({ error });
        invitePath = `/invite/${data}`;
        break;
      }
      case "revoke_invitation": {
        if (ctx.role !== "super_admin") permit("guardians.manage");
        check(
          await db
            .from("invitations")
            .update({ revoked_at: new Date().toISOString() })
            .eq("id", id())
            .eq("school_id", ctx.schoolId)
            .is("accepted_at", null),
        );
        break;
      }
      case "membership": {
        check(
          await db.rpc("manage_school_member", {
            p_member: uuid("member_id"),
            p_role: value("role"),
            p_status: value("status"),
          }),
        );
        break;
      }
      case "permission": {
        check(
          await db.rpc("set_member_permission", {
            p_member: uuid("member_id"),
            p_permission: text("permission"),
            p_mode: value("mode"),
          }),
        );
        break;
      }
      case "homework": {
        const section = uuid("section_id");
        await sameSchool("sections", section);
        if (
          !can(ctx, "homework.manage") &&
          !ctx.teachesSections.includes(section)
        )
          throw new Error("permission_denied");
        const subject = optionalId("subject_id");
        if (subject) await sameSchool("subjects", subject);
        const status = z.enum(["draft", "published"]).parse(value("status"));
        check(
          await db
            .from("homework")
            .insert({
              id: id(),
              school_id: ctx.schoolId,
              section_id: section,
              subject_id: subject,
              title: text("title"),
              instructions: value("instructions"),
              due_on: optionalDate("due_on"),
              status,
              created_by: ctx.userId,
              published_at:
                status === "published" ? new Date().toISOString() : null,
            }),
        );
        break;
      }
      case "homework_status": {
        const status = z
          .enum(["draft", "published", "archived"])
          .parse(value("status"));
        if (status === "archived" && ctx.role !== "admin" && ctx.role !== "super_admin") throw new Error("permission_denied");
        check(
          await db
            .from("homework")
            .update({
              status,
              published_at:
                status === "published" ? new Date().toISOString() : null,
            })
            .eq("id", id())
            .eq("school_id", ctx.schoolId)
            .select("id")
            .single(),
        );
        break;
      }
      case "homework_completion": {
        check(
          await db.rpc("record_homework_completion", {
            p_homework: uuid("homework_id"),
            p_student: uuid("student_id"),
            p_status: value("status"),
            p_note: value("teacher_note"),
          }),
        );
        break;
      }
      case "notice": {
        const audience = z
          .enum(["all", "staff", "guardians", "sections"])
          .parse(value("audience"));
        const section = optionalId("section_id");
        if (
          !can(ctx, "notices.manage") &&
          !(
            audience === "sections" &&
            section &&
            ctx.teachesSections.includes(section)
          )
        )
          throw new Error("permission_denied");
        if (audience === "sections" && !section)
          throw new Error("invalid_input");
        if (section) await sameSchool("sections", section);
        check(
          await db
            .from("notices")
            .insert({
              id: id(),
              school_id: ctx.schoolId,
              title: text("title"),
              body: z.string().min(1).max(10000).parse(value("body")),
              audience,
              target_ids: audience === "sections" ? [section!] : [],
              created_by: ctx.userId,
            }),
        );
        break;
      }
      case "withdraw_notice": {
        if (ctx.role !== "admin" && ctx.role !== "super_admin") throw new Error("permission_denied");
        permit("notices.manage");
        check(
          await db
            .from("notices")
            .update({ is_published: false })
            .eq("id", id())
            .eq("school_id", ctx.schoolId),
        );
        break;
      }
      case "exam": {
        permit("exams.manage");
        const { data: year, error } = await db
          .from("academic_years")
          .select("id")
          .eq("school_id", ctx.schoolId)
          .eq("is_current", true)
          .single();
        check({ error });
        const start = date("starts_on"),
          end = date("ends_on");
        if (end < start) throw new Error("invalid_input");
        const scale = optionalId("grade_scale_id");
        if (scale) await sameSchool("grade_scales", scale);
        check(
          await db
            .from("exams")
            .insert({
              id: id(),
              school_id: ctx.schoolId,
              academic_year_id: year!.id,
              name_en: text("name_en"),
              name_bn: value("name_bn") || null,
              kind: z
                .enum([
                  "class_test",
                  "monthly",
                  "half_yearly",
                  "annual",
                  "custom",
                ])
                .parse(value("kind")),
              grade_scale_id: scale,
              starts_on: start,
              ends_on: end,
              status: "marks_entry",
            }),
        );
        break;
      }
      case "grade_scale": {
        permit("exams.manage");
        check(
          await db
            .from("grade_scales")
            .insert({ id: id(), school_id: ctx.schoolId, name: text("name") }),
        );
        break;
      }
      case "grade_band": {
        permit("exams.manage");
        await sameSchool("grade_scales", uuid("scale_id"));
        const min = z.coerce
            .number()
            .min(0)
            .max(100)
            .parse(value("min_percent")),
          max = z.coerce.number().min(min).max(100).parse(value("max_percent"));
        check(
          await db
            .from("grade_bands")
            .insert({
              id: id(),
              scale_id: uuid("scale_id"),
              min_percent: min,
              max_percent: max,
              grade: text("grade"),
              grade_point: z.coerce
                .number()
                .min(0)
                .max(9.99)
                .parse(value("grade_point")),
            }),
        );
        break;
      }
      case "exam_subject": {
        permit("exams.manage");
        await sameSchool("exams", uuid("exam_id"));
        await sameSchool("classes", uuid("class_id"));
        await sameSchool("subjects", uuid("subject_id"));
        const full = z.coerce
          .number()
          .positive()
          .max(9999)
          .parse(value("full_marks"));
        const pass = z.coerce
          .number()
          .min(0)
          .max(full)
          .parse(value("pass_marks"));
        check(
          await db
            .from("exam_subjects")
            .insert({
              id: id(),
              exam_id: uuid("exam_id"),
              class_id: uuid("class_id"),
              subject_id: uuid("subject_id"),
              full_marks: full,
              pass_marks: pass,
              exam_date: optionalDate("exam_date"),
            }),
        );
        break;
      }
      case "marks": {
        const entries = z
          .array(
            z.object({
              student_id: z.uuid(),
              marks_obtained: z.number().min(0).max(9999).nullable(),
              is_absent: z.boolean(),
              expected_updated_at: z.string().nullable(),
            }),
          )
          .min(1)
          .max(5000)
          .parse(JSON.parse(z.string().max(900000).parse(form.get("entries"))));
        check(
          await db.rpc("save_exam_marks", {
            p_exam_subject: uuid("exam_subject_id"),
            p_entries: entries,
          }),
        );
        break;
      }
      case "publish_exam": {
        check(await db.rpc("publish_exam", { p_exam: id() }));
        break;
      }
      case "expense": {
        permit("expenses.create");
        await sameSchool("expense_categories", uuid("category_id"));
        const amount = parseTaka(value("amount"));
        if (amount === null || amount <= 0n) throw new Error("invalid_input");
        check(
          await db
            .from("expenses")
            .insert({
              id: id(),
              school_id: ctx.schoolId,
              category_id: uuid("category_id"),
              amount: amount.toString(),
              description: text("description"),
              spent_on: date("spent_on"),
              method: z
                .enum(["cash", "bank", "bkash", "nagad", "rocket", "other"])
                .parse(value("method")),
              vendor: value("vendor") || null,
              created_by: ctx.userId,
              idempotency_key: id(),
            }),
        );
        break;
      }
      case "expense_category": {
        permit("expenses.approve");
        check(
          await db
            .from("expense_categories")
            .insert({
              id: id(),
              school_id: ctx.schoolId,
              name_en: text("name_en"),
              name_bn: text("name_bn"),
            }),
        );
        break;
      }
      case "decide_expense": {
        permit("expenses.approve");
        const decision = z.enum(["approve", "reject"]).parse(value("decision"));
        const note = value("note");
        if (decision === "reject" && note.length < 3)
          throw new Error("reason_required");
        await sameSchool("expenses", id());
        check(
          await db.rpc("decide_expense", {
            p_expense: id(),
            p_approve: decision === "approve",
            p_note: note || null,
          }),
        );
        break;
      }
      case "guardian_contact": {
        if (ctx.role !== "guardian") throw new Error("permission_denied");
        check(
          await db.rpc("update_my_guardian_contact", {
            p_phone: text("phone"),
            p_address: value("address"),
          }),
        );
        break;
      }
      default:
        throw new Error("invalid_input");
    }
    revalidatePath("/", "layout");
    return { success: true, invitePath };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/duplicate|23505/i.test(message))
      return {
        error: bn
          ? "এই রেকর্ডটি ইতিমধ্যে আছে। পৃষ্ঠাটি রিফ্রেশ করুন।"
          : "This record already exists. Refresh the page.",
      };
    if (/conflict/i.test(message))
      return {
        error: bn
          ? "অন্য কেউ পরিবর্তন করেছেন। রিফ্রেশ করে আবার চেষ্টা করুন।"
          : "Someone changed this record. Refresh and try again.",
      };
    if (/incomplete_marks/i.test(message))
      return {
        error: bn
          ? "সব বিষয়ের সব শিক্ষার্থীর নম্বর সংরক্ষণ করে প্রকাশ করুন।"
          : "Save marks for every student in every subject before publishing.",
      };
    if (/incomplete_grading_scale/i.test(message))
      return {
        error: bn
          ? "গ্রেড স্কেলে সব নম্বরের জন্য গ্রেড সীমা যোগ করুন।"
          : "Add grade bands covering every score before publishing.",
      };
    if (/overlapping_grade_band/i.test(message))
      return {
        error: bn
          ? "এই গ্রেডের সীমা অন্য গ্রেডের সাথে মিলে যাচ্ছে।"
          : "This percentage range overlaps another grade band.",
      };
    if (/permission|42501/i.test(message))
      return {
        error: bn
          ? "এই কাজের অনুমতি নেই।"
          : "You do not have permission for this action.",
      };
    return {
      error: bn
        ? "সংরক্ষণ করা যায়নি। তথ্য যাচাই করে আবার চেষ্টা করুন।"
        : "Could not save. Check the details and try again.",
    };
  }
}
