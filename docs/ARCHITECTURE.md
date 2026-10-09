# Bright Learning School — System Architecture

School management PWA for **Bright Learning School, Mulagul, Kanaighat, Sylhet**.
Every school detail (names in both languages, address, contacts, logo, colours, receipt
headers) lives in the `schools` table and is edited from **Settings → School profile**.
Nothing about the school is hardcoded in components.

## 1. Big picture

```
 Phones / PCs (installable PWA)
        │  HTTPS
        ▼
 Next.js (App Router) on Vercel
   • Server Components read data with the *user's* session (RLS applies)
   • Server Actions / Route Handlers for writes → call Postgres RPCs
   • Service-role key used ONLY server-side, for invitations + bootstrap
        │
        ▼
 Supabase
   • Postgres  ── single source of truth, RLS on every table
   • Auth      ── Google OAuth + email/password, email verification, reset
   • Realtime  ── change signals only; clients re-fetch authoritative data
   • Storage   ── private buckets, signed URLs, path = <school_id>/...
```

## 2. Directory layout

```
bright-school/
  docs/                    architecture, deployment guide, owner guide
  supabase/
    migrations/            numbered SQL migrations (apply in order)
    seed/                  school.sql (Bright Learning School profile, editable later)
    tests/                 SQL tests: RLS isolation, payments, permissions
  src/
    app/
      (auth)/              login, signup, reset (language from a cookie, so switching keeps your place)
      (app)/               signed-in phone-app shell: top app bar + bottom tab bar + "More" sheet
          dashboard/ students/ guardians/ teachers/ attendance/ classes/
          homework/ exams/ fees/ payments/ expenses/ reports/ notices/
          staff/ settings/ onboarding/ help/
        portal/            guardian home
      auth/callback/       OAuth / email-link callback
      invite/[token]/      accept an invitation
    components/            ui primitives, layout, charts, forms
    lib/
      supabase/            browser + server + admin(service) clients
      auth/                session + permission helpers
      money.ts             poisha <-> taka, ৳ formatting, Bengali digits
    messages/              bn.json, en.json
```

## 3. Role & permission model

Roles are rows, not code. Each role has a default permission set; the Super Admin can add
or remove individual permissions per user (`user_permission_overrides`).

| Permission group | Super Admin | Admin (default) | Accountant | Teacher | Guardian |
|---|---|---|---|---|---|
| students.view / create / edit / archive | all | all | view | view (own sections) | own children |
| guardians.manage | ✓ | ✓ | – | – | – |
| attendance.view / create | ✓ | ✓ | – | own sections | own children |
| attendance.correct | ✓ | ✓ | – | – | – |
| homework.manage | ✓ | ✓ | – | own sections | view |
| exams.manage / marks.enter / results.publish | ✓ | ✓ / – / ✓ | – | marks.enter own | published only |
| fees.view / collect | ✓ | ✓ | ✓ | – | own children |
| fees.configure / adjust / reverse / refund | ✓ | – | – | – | – |
| expenses.create | ✓ | – | ✓ | – | – |
| expenses.approve | ✓ | – | – | – | – |
| reports.view / export | ✓ | ✓ | finance only | – | – |
| notices.manage | ✓ | ✓ | – | own classes | – |
| staff.manage, settings.manage, audit.view | ✓ | – | – | – | – |

"Admin (default)" is a starting point; the owner toggles each permission per person.

**Enforcement happens in three layers:** (1) Postgres RLS on every table, using
`has_perm()`, `is_guardian_of()`, `teaches_section()`; (2) financial and privileged writes
only through `SECURITY DEFINER` functions that re-check permissions; (3) the UI hides what
you can't do — for convenience only, never as security.

The Super Admin role cannot be removed or reassigned by anyone except through the
database (protected by trigger), and there is always at least one.

## 4. Authentication & onboarding

1. Owner deploys, sets `BOOTSTRAP_OWNER_EMAIL` in Vercel.
2. Owner signs in (Google or email). If no Super Admin exists **and** the verified email
   matches `BOOTSTRAP_OWNER_EMAIL`, the server grants Super Admin. Otherwise nothing.
3. Everyone else must be **invited**: owner enters email + role + permissions → a
   one-time token (hashed in DB, 7-day expiry). On sign-in the token is validated and
   the email must match. Google sign-in alone never grants any role.
4. Guardians are linked to students only by staff (`student_guardians`).

## 5. Money & financial integrity

- All amounts are **integer poisha** (`bigint`, ৳1 = 100). No floats anywhere.
- `invoices` → `invoice_items` (billed). `payments` → `payment_allocations` (collected,
  allocated to items). Outstanding = billed − discounts − allocated (+ reversed back).
- `post_payment()` RPC: one transaction, row-locks the invoice items, validates the
  amount server-side, enforces `UNIQUE(school_id, idempotency_key)` so a double tap or
  retry returns the *same* payment, generates the receipt number from a locked counter.
- Confirmed payments are immutable (trigger). Mistakes are fixed with
  `reverse_payment()` (requires reason, permission, writes audit log).
- bKash / Nagad / Rocket / bank entries are stored as **"manually recorded reference"**
  with `verification_status = 'unverified'` and shown that way on receipts and reports.
- Collections, billed amounts, receivables, discounts and refunds are separate figures in
  reports — never mixed.

## 6. Realtime strategy

Realtime events are used as a "something changed" signal only. On an event (or on
reconnect / tab focus) the client re-fetches from the server, which runs under RLS.
Supabase Realtime itself respects RLS for `postgres_changes`, so guardians only receive
events for rows they could read anyway. Financial screens never show a payment as saved
until the RPC returns success.

## 7. Offline / PWA

Service worker caches static assets and the app shell only. Student and finance data is
never cached by the service worker. Writes require a connection; the UI says so clearly.

## 8. Assumptions (change any of them in Settings)

- School: Bright Learning School / ব্রাইট লার্নিং স্কুল — Mulagul, Kanaighat, Sylhet
  (the prompt said "Kanighat"; I used the official upazila spelling *Kanaighat*).
- Academic year = calendar year (January–December), timezone Asia/Dhaka.
- Default classes: Playgroup, Nursery, KG, Class 1–5 (editable, not hardcoded).
- Default language Bengali; currency ৳ BDT.

## 9. Phone-app design

The whole interface is a phone app (max width 480px). On a computer the same app is shown
centred — there is no separate desktop dashboard. Navigation: top app bar (school crest,
name, notifications, profile/language/theme sheet) and a bottom tab bar with the four
most-used sections for the person's role plus "More" for everything they're allowed to use.

Branding: the Bright Learning School crest (`public/brand/logo.png`) is the default logo and
app icon. Uploading a different logo in Settings replaces it in the app; colours default to the
crest's navy `#114364` with its orange `#EE7C19` for decorative accents.
