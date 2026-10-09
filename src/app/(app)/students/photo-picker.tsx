"use client";
import { useRef, useState } from "react";
import { Camera, Loader2, Trash2, UserRound } from "lucide-react";
import { Avatar } from "@/components/page";
import { Notice } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";
import { shrinkPhoto } from "@/lib/image";
import { useT } from "@/lib/i18n/client";
import { setStudentPhoto } from "./actions";

/** Shrinks the photo on the phone, uploads it to the private bucket, returns its path. */
async function uploadPhoto(schoolId: string, file: File): Promise<string> {
  const blob = await shrinkPhoto(file);
  const path = `${schoolId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabaseBrowser().storage.from("student-photos").upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  return path;
}

function PickerButton({ onFile, busy, size, children }: { onFile: (f: File) => void; busy: boolean; size: number; children: React.ReactNode }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      {/* no "capture" attribute: phones offer both camera and gallery */}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/*" className="sr-only"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onFile(f); }} />
      <button type="button" onClick={() => input.current?.click()} disabled={busy} className="press relative rounded-[28px]" style={{ width: size, height: size }}>
        {children}
        <span className="absolute -bottom-1 -right-1 grid size-9 place-items-center rounded-full bg-brand text-white ring-4 ring-surface">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
        </span>
      </button>
    </>
  );
}

/** On the student profile: tap the picture to add or change it. */
export function ProfilePhoto({ studentId, schoolId, name, src, canEdit }: {
  studentId: string; schoolId: string; name: string; src: string | null; canEdit: boolean;
}) {
  const { t } = useT();
  const s = t.students;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const shown = preview ?? src;
  const avatar = <Avatar name={name} id={studentId} size={96} src={shown} className="rounded-[28px]" />;
  if (!canEdit) return avatar;

  const pick = async (file: File) => {
    setBusy(true); setMsg(null);
    try {
      const path = await uploadPhoto(schoolId, file);
      const r = await setStudentPhoto(studentId, path);
      if (!r?.ok) throw new Error(r?.error ?? "save");
      setPreview(URL.createObjectURL(file));
      setMsg({ tone: "success", text: s.photoSaved });
    } catch {
      setMsg({ tone: "error", text: s.photoError });
    } finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true); setMsg(null);
    const r = await setStudentPhoto(studentId, null);
    setBusy(false);
    if (r?.ok) { setPreview(null); setMsg({ tone: "success", text: s.photoRemoved }); }
    else setMsg({ tone: "error", text: t.common.errorGeneric });
  };

  return (
    <div className="flex flex-col items-center">
      <PickerButton onFile={pick} busy={busy} size={96}>{avatar}</PickerButton>
      <span className="sr-only">{shown ? s.changePhoto : s.addPhoto}</span>
      {shown && !busy && (
        <button type="button" onClick={remove} className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-ink-2">
          <Trash2 className="size-4" />{s.removePhoto}
        </button>
      )}
      {busy && <p className="mt-2 text-[13px] text-ink-2" role="status">{s.uploading}</p>}
      {msg && <Notice tone={msg.tone} className="mt-3">{msg.text}</Notice>}
    </div>
  );
}

/** On the admission form: upload first, the form then sends the path with the rest. */
export function AdmissionPhoto({ schoolId, initialPath }: { schoolId: string; initialPath?: string }) {
  const { t } = useT();
  const s = t.students;
  const [path, setPath] = useState(initialPath ?? "");
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const pick = async (file: File) => {
    setBusy(true); setError(false);
    try {
      setPath(await uploadPhoto(schoolId, file));
      setPreview(URL.createObjectURL(file));
    } catch { setError(true); } finally { setBusy(false); }
  };
  return (
    <div className="flex items-center gap-4">
      <input type="hidden" name="photo_path" value={path} />
      <PickerButton onFile={pick} busy={busy} size={80}>
        {preview
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={preview} alt="" className="size-20 rounded-[24px] object-cover" />
          : <span className="grid size-20 place-items-center rounded-[24px] border-2 border-dashed border-line bg-surface-2 text-ink-2/60"><UserRound className="size-9" /></span>}
      </PickerButton>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{preview ? s.changePhoto : s.addPhoto} <span className="font-normal text-ink-2">({t.common.optional})</span></p>
        <p className="text-[13px] text-ink-2">{busy ? s.uploading : s.photoHint}</p>
        {error && <p className="mt-1 text-[13px] font-medium text-danger" role="alert">{s.photoError}</p>}
      </div>
    </div>
  );
}
