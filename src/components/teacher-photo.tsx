"use client";
import { useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { Avatar } from "./page";
import { Notice } from "./ui";
import { useT } from "@/lib/i18n/client";
import { shrinkPhoto } from "@/lib/image";
import { supabaseBrowser } from "@/lib/supabase/client";
import { setTeacherPhoto } from "@/lib/workflows/staff-photos";

export function TeacherPhoto({ staffId, schoolId, name, src }: {
  staffId: string; schoolId: string; name: string; src: string | null;
}) {
  const { t } = useT();
  const input = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState(src);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<"saved" | "removed" | "error" | null>(null);
  const pick = async (file: File) => {
    setBusy(true); setMessage(null);
    const db = supabaseBrowser();
    let path: string | null = null;
    let linked = false;
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error("too_large");
      const blob = await shrinkPhoto(file);
      path = `${schoolId}/${crypto.randomUUID()}.jpg`;
      const { error } = await db.storage.from("teacher-photos").upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (error) throw error;
      const result = await setTeacherPhoto(staffId, path);
      if (!result.ok) throw new Error("save_failed");
      linked = true;
      setPhoto(result.url);
      setMessage("saved");
    } catch {
      if (path && !linked) await db.storage.from("teacher-photos").remove([path]);
      setMessage("error");
    } finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true); setMessage(null);
    try {
      const result = await setTeacherPhoto(staffId, null);
      if (!result.ok) throw new Error("save_failed");
      setPhoto(null); setMessage("removed");
    } catch { setMessage("error"); }
    finally { setBusy(false); }
  };
  return (
    <div className="mb-3 space-y-2">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface-2 p-3">
        <Avatar name={name} id={staffId} size={72} src={photo} />
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy}
          aria-label={`${t.students.addPhoto}: ${name}`}
          onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void pick(file); }} />
        <button type="button" disabled={busy} onClick={() => input.current?.click()}
          className="press inline-flex min-h-12 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm font-semibold disabled:opacity-50">
          {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Camera aria-hidden className="size-4" />}
          {photo ? t.students.changePhoto : t.students.addPhoto}
        </button>
        {photo && <button type="button" disabled={busy} onClick={remove}
          className="inline-flex min-h-11 items-center gap-1 text-sm text-danger">
          <Trash2 aria-hidden className="size-4" />{t.students.removePhoto}
        </button>}
      </div>
      {busy && <p role="status" className="text-sm text-ink-2">{t.students.uploading}</p>}
      {message && <Notice tone={message === "error" ? "error" : "success"}>
        {message === "saved" ? t.students.photoSaved : message === "removed" ? t.students.photoRemoved : t.students.photoError}
      </Notice>}
    </div>
  );
}
