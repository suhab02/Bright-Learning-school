import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { Button, Card, Notice, Skeleton } from "@/components/ui";

async function accept(formData: FormData) {
  "use server";
  const token = String(formData.get("token") ?? "");
  if (!/^[0-9a-f]{64}$/.test(token)) redirect(`/invite/${encodeURIComponent(token)}?failed=1`);
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error) redirect(`/invite/${token}?failed=1`);
  redirect("/");
}

async function Invite({ params, searchParams }: PageProps<"/invite/[token]">) {
  const [{ token }, sp, { t }] = await Promise.all([params, searchParams, getT()]);
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <Card className="p-6">
      <h1 className="text-xl font-semibold">{t.auth.inviteTitle}</h1>
      <p className="mt-2 text-ink-2">{t.auth.inviteBody}</p>
      {sp.failed && <Notice tone="error" className="mt-4">{t.auth.inviteInvalid}</Notice>}
      {user ? (
        <form action={accept} className="mt-5 flex flex-col gap-3">
          <input type="hidden" name="token" value={token} />
          <p className="text-sm text-ink-2">{user.email}</p>
          <Button type="submit" size="lg">{t.auth.inviteAccept}</Button>
        </form>
      ) : (
        <Link href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`} className="mt-5 block">
          <Button size="lg" className="w-full">{t.auth.signIn}</Button>
        </Link>
      )}
    </Card>
  );
}

export default function Page(props: PageProps<"/invite/[token]">) {
  return <main className="mx-auto max-w-md p-4 pt-16"><Suspense fallback={<Skeleton className="h-60" />}><Invite {...props} /></Suspense></main>;
}
