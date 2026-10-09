"use client";
import { useRef, useState, useTransition } from "react";
import { Upload, Trash2 } from "lucide-react";
import { Button, Card, Notice } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/client";
import { setLogo } from "./actions";

const TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg" };

export function LogoUpload({ schoolId, logoUrl, custom, readOnly }: { schoolId: string; logoUrl: string; custom: boolean; readOnly: boolean }) {
  const { t } = useT();
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    const ext = TYPES[file.type];
    if (!ext || file.size > 2 * 1024 * 1024) { setError(t.settings.logoHint); return; }
    const path = `${schoolId}/logo-${Date.now()}.${ext}`;
    const { error: upErr } = await supabaseBrowser().storage.from("branding").upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) { setError(t.common.errorGeneric); return; }
    start(async () => {
      const r = await setLogo(path);
      if (!r?.ok) setError(r?.error === "permission" ? t.common.permissionDenied : t.common.errorGeneric);
    });
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-2xl border border-line bg-surface-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt={t.settings.logo} className="size-full object-contain p-1" />
      </div>
      <div className="flex-1">
        <h2 className="font-semibold">{t.settings.logo}</h2>
        <p className="text-sm text-ink-2">{t.settings.logoHint}</p>
        {error && <Notice tone="error" className="mt-2">{error}</Notice>}
        {!readOnly && (
          <div className="mt-3 flex flex-wrap gap-2">
            <input ref={input} type="file" accept={Object.keys(TYPES).join(",")} className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
            <Button type="button" variant="secondary" disabled={pending} onClick={() => input.current?.click()}>
              <Upload className="size-4" aria-hidden />{t.settings.uploadLogo}
            </Button>
            {custom && (
              <Button type="button" variant="ghost" disabled={pending} onClick={() => start(async () => { await setLogo(null); })}>
                <Trash2 className="size-4" aria-hidden />{t.settings.removeLogo}
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
