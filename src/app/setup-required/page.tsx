export const metadata = { title: "Setup required" };

/** Shown only until the Supabase environment variables are configured on the server. */
export default function SetupRequired() {
  return (
    <main className="mx-auto max-w-2xl p-6 pt-16">
      <h1 className="text-2xl font-bold">Almost there — connect the database</h1>
      <p className="mt-3 text-ink-2">
        The app is running, but it isn&apos;t connected to Supabase yet. Add these environment
        variables in Vercel (Project → Settings → Environment Variables), then redeploy:
      </p>
      <pre className="mt-4 overflow-x-auto rounded-xl bg-surface border border-line p-4 text-sm">{`NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...      (server only — never share)
BOOTSTRAP_OWNER_EMAIL=you@example.com
NEXT_PUBLIC_SITE_URL=https://your-app.vercel.app`}</pre>
      <p className="mt-4 text-ink-2">Step-by-step instructions are in docs/DEPLOYMENT.md.</p>
    </main>
  );
}
