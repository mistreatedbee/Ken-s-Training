# Ken's Training Institute — Admissions

Public application form (`/apply`) and admin dashboard (`/admin`) for Ken's Training Institute.
Next.js 16 (App Router) + Supabase (Postgres, Auth, Storage), deployed on Vercel.

## What the admin dashboard does

| Area | Who can change it | Notes |
|---|---|---|
| Dashboard | — | Live counts, recent activity, course/pricing summary |
| Applications | Admissions | Search, filter, sort, paginate; status changes, notes, edits, archive; full history; CSV export |
| Courses & fees | Course admin | Create/edit/deactivate/archive courses; price history, scheduled prices, promotional discounts; intakes; capacity |
| Application form | Super admin | Edit questions, documents, open/close dates, declaration and confirmation text; save draft → preview → publish |
| Payments | Finance | Record payments/refunds received outside the system; void with reason; balances |
| Reports | — | Date-ranged summaries by status, course, intake, month; payments; pricing; CSV |
| WhatsApp | Admissions | Message templates; opens WhatsApp with a pre-filled message (delivery is **not** tracked) |
| Staff & roles, Audit log | Super admin | Add staff, change roles, deactivate, reset passwords; audit of sensitive changes |

Roles: **super_admin** (everything), **admissions**, **course_admin**, **finance**, **read_only**.
Permissions are enforced in the database (row-level security + triggers), and checked again in server actions.

Key rules enforced by the database:

- Only **active**, open courses (deadline not passed) can receive applications; intakes and study modes are validated.
- Each application stores a **snapshot of the fees** at submission. Later price changes never alter it.
- Prices are append-only history; courses with applications can't be deleted (archive instead).
- Accepting beyond a course's/intake's capacity is blocked.
- Status changes, edits, notes, payments and prepared messages are recorded in the application history; saving an unchanged status records nothing.
- Anonymous visitors cannot read or insert applications directly — submissions go through the server.

## Environment variables

| Name | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel + `.env.local` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel + `.env.local` | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel + `.env.local` (**server only**) | Used only for public submissions/uploads and creating staff accounts. Never expose it to the browser. |

No email provider is configured. Notifications use WhatsApp links that an admin sends manually.

## Deploying this version (order matters)

1. **Back up the database** (Supabase Dashboard → Database → Backups).
2. In the SQL Editor, run `supabase/migrations/20261013_admin_management_system.sql`.
   - Requires `20260813_fix_approval_trigger_consistency.sql` to have been run.
   - It is additive and idempotent: existing applications are kept and linked to the new `courses` rows.
   - **Never re-run `20240101000000_initial_schema.sql`** — it drops all tables.
3. Grant yourself access (nobody has admin access until you do):
   ```sql
   select id, email from auth.users order by created_at;   -- find your account

   insert into staff_users (user_id, email, full_name, role)
   select id, email, 'Your Name', 'super_admin' from auth.users where email = 'you@example.com'
   on conflict (user_id) do update set role = 'super_admin', active = true;
   ```
4. Supabase → Authentication → Providers → Email: turn **off** “Allow new users to sign up”.
5. Make sure `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel (Production), then deploy the code.
   Deploying before step 2 takes the public form offline (it needs `get_public_catalog`).
6. In the dashboard: **Courses & fees** — set fees for each course (none were invented by the migration),
   add intakes if needed. Then **Application form** → Preview → Publish once to lock in the current form.
7. Add other staff under **Staff & roles**.

## Development

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm test         # unit tests + database tests (in-process Postgres via PGlite, no Docker needed)
pnpm build
```

The database tests (`tests/db`) apply every migration in `supabase/migrations` to an in-memory Postgres with a
small Supabase shim (roles, `auth.uid()`, storage tables), then test permissions, pricing, submission,
capacity, payments, reports and migrating existing data.
