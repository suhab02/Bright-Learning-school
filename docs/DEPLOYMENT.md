# Putting Bright Learning School online — step by step

This guide assumes no programming experience. Set aside about an hour. You need:
a Google account, a GitHub account (free), and a computer with a web browser.

You will create three free accounts: **Supabase** (database + logins), **Vercel** (runs the
website), and **Google Cloud** (only for the "Continue with Google" button).

> **About "free".** Free tiers change, and none of these services promise to stay free
> forever. As of mid-2026, things to know (check each provider's pricing page yourself):
> - **Supabase Free** pauses a project after about a week with no activity (one click
>   restores it) and does **not** include automatic daily backups — see "Backups" below.
>   The built-in email sender is limited to a handful of emails per hour and is meant for
>   testing; for real use, connect a free SMTP sender (step 4).
> - **Vercel Hobby (free)** is licensed for personal, **non-commercial** use. A school that
>   charges fees may need **Vercel Pro** (paid) to comply. Read Vercel's terms and decide.
> - SMS is **not** used, so there is no SMS cost. bKash/Nagad/Rocket payments are only
>   *recorded* by your staff — the app does not connect to those services.

---

## Step 1 — Put the code on GitHub

1. Sign in to github.com → **New repository** → name it `bright-school` → **Private** → Create.
2. Upload this project folder to that repository (GitHub Desktop is the easiest way:
   *File → Add local repository → Publish*).
   The file `.env.local` is deliberately ignored and must never be uploaded.

## Step 2 — Create the Supabase project

1. Go to supabase.com → **Start your project** → sign in with GitHub.
2. **New project**. Name: `bright-school`. Database password: click *Generate*, then save
   it in a password manager. Region: **Singapore** (closest to Bangladesh) → Create.
3. Wait until the project says it is ready.

## Step 3 — Create the database tables

1. In Supabase, open **SQL Editor** (left menu) → **New query**.
2. Open each file below from the project's `supabase/migrations` folder **in this order**,
   copy *all* of its text, paste it into the editor and press **Run**. Each must say
   *Success*. If one fails, stop and send the error message to whoever is helping you.
   1. `0001_core.sql`
   2. `0002_academic.sql`
   3. `0003_finance.sql`
   4. `0004_rls.sql`
   5. `0005_storage_realtime.sql`
   6. `0006_app_context.sql`
3. Finally run `supabase/seed/school.sql`. This creates **Bright Learning School,
   Mulagul, Kanaighat, Sylhet** with classes Playgroup → Class Five, subjects, fee and
   expense categories, and the GPA scale. It adds **no** students, payments or attendance.
   Everything it creates can be changed later inside the app.

## Step 4 — Logins and email

1. **Authentication → Sign In / Providers → Email**: make sure *Enable email provider* and
   *Confirm email* are on.
2. **Authentication → URL Configuration**:
   - *Site URL*: your Vercel address from step 6 (come back and fill it in later), e.g.
     `https://bright-learning.vercel.app`
   - *Redirect URLs*: add `https://bright-learning.vercel.app/**`
3. **Email sending (recommended):** create a free account with an email-sending service such
   as Resend or Brevo, verify your domain or sender address, then in Supabase go to
   **Authentication → Emails → SMTP Settings** and enter the host, port, user and password
   they give you. Without this, sign-up and password-reset emails may be slow or not arrive.

## Step 5 — "Continue with Google" (optional but recommended)

1. Go to console.cloud.google.com → create a project called `Bright School`.
2. **APIs & Services → OAuth consent screen**: choose *External*, app name
   `Bright Learning School`, your email as support email → Save. Publish the app when
   prompted (otherwise only test users can sign in).
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: *Web application*
   - Authorized redirect URI: `https://YOUR-PROJECT-ID.supabase.co/auth/v1/callback`
     (copy the exact address from Supabase → Authentication → Sign In / Providers → Google)
4. Copy the *Client ID* and *Client secret* into Supabase → **Authentication → Sign In /
   Providers → Google** → enable → Save.

Signing in with Google never gives anyone access by itself. People only get in after you
invite them (or, for you alone, through `BOOTSTRAP_OWNER_EMAIL`).

## Step 6 — Put the website on Vercel

1. Go to vercel.com → sign in with GitHub → **Add New → Project** → import `bright-school`.
2. Before clicking Deploy, open **Environment Variables** and add these five. Values come
   from Supabase → **Project Settings → API Keys** and **Data API**:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | the Project URL, e.g. `https://abcd1234.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the **publishable** key (`sb_publishable_…`), or the legacy *anon* key |
   | `SUPABASE_SERVICE_ROLE_KEY` | the **secret** key (`sb_secret_…`), or the legacy *service_role* key. **Never share this.** |
   | `BOOTSTRAP_OWNER_EMAIL` | **your** email — the only address that can become Super Admin |
   | `NEXT_PUBLIC_SITE_URL` | your Vercel address, e.g. `https://bright-learning.vercel.app` |

3. Click **Deploy**. When it finishes, open the address. You should see the sign-in page
   with ব্রাইট লার্নিং স্কুল at the top.
4. Go back to step 4.2 and fill in the Site URL / Redirect URL with this address.

## Step 7 — Become the Super Admin

1. On your new site, click **Continue with Google** using the email you put in
   `BOOTSTRAP_OWNER_EMAIL` — or create an account with that email and confirm it from your inbox.
2. You land on the dashboard as **Super Admin**. This only works once: after the school has
   an owner, nobody else can become one this way.
3. Open **Settings** and check every detail: Bangla and English names, address, phone,
   logo, colours, receipt prefix (`BLS` gives receipts like `BLS-2026-000001`).

## Step 8 — Install it on phones

- **Android (Chrome):** open the site → ⋮ menu → **Install app** (or *Add to Home screen*).
- **iPhone (Safari):** open the site → Share button → **Add to Home Screen**.

The app needs internet to save anything. It never stores student or payment records on the
phone for offline use.

## Backups

- **Free tier:** no automatic backups. Once a week (and before big changes) do a manual
  backup: Supabase → **Database → Backups** shows your options; with the Supabase CLI you
  can run `supabase db dump --linked -f backup-YYYY-MM-DD.sql`. Keep copies in two places
  (e.g. Google Drive and a USB drive).
- **Pro tier (paid):** daily automatic backups with restore from the dashboard.
- In-app data export for students and finance reports is planned in a later phase.

## Checking that everything is safe (for whoever helps you)

```bash
# database security + money tests against a local Postgres 16
PGHOST=/tmp PGPORT=54329 supabase/tests/run.sh

# end-to-end browser tests against a local Supabase Auth + PostgREST stack
supabase/local-stack/start.sh          # needs the official auth + postgrest binaries in /opt/sbx
npm run build && npm start &
npx playwright test
```
