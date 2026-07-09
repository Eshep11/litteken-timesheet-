# Litteken Plumbing — Time Sheets (multi-user)

A web app where your crew each keep their own weekly time sheets, and bosses
can review everyone's.

- Everyone signs in with their own account (email + password).
- **Employees** see and edit only their own weekly sheets.
- **Bosses** can view and print everyone's sheets, invite people, and remove
  people who've left — but only the employee can edit their own hours. This
  keeps each timesheet an honest record authored by the person who worked.
- Two sign-up codes control who can join: an **employee code** and a
  **boss code**. You hand out whichever is right for each person.
- Any week can be printed / saved as a PDF (Print → "Save as PDF").

Built with Next.js, Clerk (sign-in), and Neon Postgres. Runs free.

---

## How accounts work

There's no Google setup. People sign up with an email and password. Right
after signing up, they enter their **name** and an **access code**:

- Enter the **employee code** → they become an employee.
- Enter the **boss code** → they become a boss.

Without a valid code they can't see anything, so the code is what actually lets
someone in. You set both codes (and can change them anytime) in Vercel.

You'll set up three free accounts: **Clerk** (sign-in), **Neon** (database),
and **Vercel** (hosting). About 30 minutes total.

---

## Step 1 — Clerk (sign-in)

1. Go to **https://clerk.com** → sign up (free).
2. Click **Create application**. Give it a name (e.g. "Litteken Timesheet").
3. For sign-in options, make sure **Email** and **Password** are turned on.
   You can leave the rest off. Click **Create application**.
4. You'll land on the **API keys** page. You need two values (they start with
   `pk_test_` and `sk_test_`). Keep this tab open — you'll paste them into
   Vercel in Step 3:
   - **Publishable key** → `pk_test_...`
   - **Secret key** → `sk_test_...`

That's it for Clerk. These are development keys, which work on your Vercel web
address. (A small "development" badge shows on the login box, and there's a
~100-account limit — both fine for your team. A cleaner setup with no badge
needs a custom domain, which you can add later; see the end of this file.)

---

## Step 2 — Database (Neon)

Easiest is to add Neon from inside Vercel (Step 3). To do it directly instead:

1. Go to **https://neon.tech** → sign up (free, no credit card).
2. **Create a project**.
3. Copy the **Connection string** (looks like
   `postgresql://user:pass@ep-xxxx.neon.tech/dbname?sslmode=require`).

The app builds its own tables automatically — no SQL to write.

---

## Step 3 — Vercel (hosting + settings)

1. Push this project to a new **GitHub** repository (the GitHub Desktop app is
   the easiest way: https://desktop.github.com).
2. Go to **https://vercel.com** → sign up with GitHub.
3. **Add New… → Project** → import your repository. Leave build settings as-is.
4. **Add the database:** project → **Storage** tab → **Create Database → Neon**
   → follow the prompts. This sets `DATABASE_URL` for you automatically.
   (Skip Step 2 if you do this.)
5. **Add all the settings:** project → **Settings → Environment Variables**.
   Add each of these (name on the left, value on the right):

   | Name | Value |
   |------|-------|
   | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | your `pk_test_...` from Clerk |
   | `CLERK_SECRET_KEY` | your `sk_test_...` from Clerk |
   | `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
   | `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |
   | `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `/` |
   | `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | `/` |
   | `EMPLOYEE_CODE` | any code you make up (give to employees) |
   | `BOSS_CODE` | a different code you make up (give to bosses) |
   | `DATABASE_URL` | (already set if you did step 4) |

6. Go to **Deployments** → the top one → **⋯** → **Redeploy**. (Settings only
   take effect on a fresh deploy.)
7. Vercel gives you a URL like `https://litteken-timesheet.vercel.app`. Share it
   with your crew.

---

## Using it

**First time, each person:**
1. Open the site → **Sign up** → enter email + password.
2. On the next screen, enter your **name** and your **access code** (employee
   or boss code, whichever you were given).

**Employees:** your weeks are listed on the left (newest first). **+ New**
starts a week, fill in the grid, **Save**. **Download / Print** makes a PDF.

**Bosses:** a **"Viewing employee"** dropdown at the top lets you pick any
employee and review their sheets (view and print only — you can't change an
employee's hours). Use the **Manage team** button to:

- **Invite** people — pick "employee" or "boss" and it builds a ready-to-send
  message with the sign-up link and access code. Copy it and send by text/email.
- **Remove** people who've left — this deletes their access and timesheets.
  (Their Clerk login stays; delete it in the Clerk dashboard if you want it
  fully gone.)

---

## Submitting and locking time sheets

To keep every time sheet an honest, unaltered record, employees submit their
own hours — and once submitted, that week locks and can't be edited by anyone,
including managers (who are always view-only).

- **Submit** — a small button (separate from Save) that locks the week going
  forward. It asks for confirmation first, so it can't be tapped by accident.
- **Automatic deadline** — even if an employee never hits Submit, a week
  automatically locks after its deadline: the **Wednesday of the following
  week**. Example: the week of Mon Jul 6–Sun Jul 12 stays editable through end
  of day Wed Jul 15, then locks on its own.
- **Timestamps** — every sheet shows when it was **created**, last **updated**,
  and (if applicable) **submitted**. Managers can use this to confirm a sheet
  wasn't deleted and quietly recreated later.
- **Accidental submit?** Delete is still allowed even on a locked/submitted
  week — that's the intentional recovery path. Deleting and starting over
  still shows a fresh "Created" time, so it's visible, not hidden.
- **Send back for edits (manager)** — while reviewing a submitted sheet, a
  manager can click "Send back for edits" to unlock it so the employee can
  fix a mistake and re-submit. The manager still never edits the content
  themselves. Note: if the Wednesday deadline has already passed, the sheet
  re-locks from the deadline rule regardless — the app tells the manager
  when that's the case so they can follow up right away.
- **Weekly status (manager view)** — pick a week and see who has and hasn't
  submitted yet, so you know who to remind. Managers are never included in
  this list.

## Managing your team

**Fix a misspelled or wrong name:** open Manage team and click "Edit name"
next to that person — no database access needed.

**Change a code:** update `EMPLOYEE_CODE` or `BOSS_CODE` in Vercel → Settings →
Environment Variables, then Redeploy. (People already signed in stay in; the new
code only affects new sign-ups.)

**Change someone's role, or reset their access:** open your database and edit
the `users` table. In Vercel → **Storage** → open your Neon database → **SQL
Editor**, then run one of these (replace the email):

- See everyone: `SELECT name, email, role FROM users;`
- Make someone a boss: `UPDATE users SET role='boss' WHERE email='them@example.com';`
- Make someone an employee: `UPDATE users SET role='employee' WHERE email='them@example.com';`
- Reset a person (they'll re-enter a code next time):
  `DELETE FROM users WHERE email='them@example.com';`

**Remove someone entirely:** delete their account in the Clerk dashboard
(Users list), and delete their row from the `users` table as above.

---

## Costs

Free on Clerk (up to 50,000 users), Neon, and Vercel free tiers. Note: Vercel's
free Hobby plan is meant for non-commercial use — for a small internal tool this
is a common gray area; Cloudflare Pages or Netlify free tiers allow commercial
use if you want to be strict.

---

## Optional: a cleaner setup with your own domain (later)

If you buy a domain (e.g. from Namecheap) and want to drop the "development"
badge and the 100-account limit, you can create a Clerk **production instance**
and point the domain at Vercel. Clerk's guide walks through it:
https://clerk.com/docs/guides/development/deployment/production
This is optional — the app works fully without it.

---

## Common gotchas

- **Blank or error after signing in:** you land on the "enter access code"
  screen — that's expected the first time. Enter your name + code.
- **"That access code isn't valid":** check `EMPLOYEE_CODE` / `BOSS_CODE` in
  Vercel and that you Redeployed after setting them. Codes are case-sensitive.
- **Can't sign in at all / Clerk errors:** double-check both Clerk keys are set
  in Vercel and you Redeployed.
- **Database errors:** confirm `DATABASE_URL` is set, then Redeploy.
- **Changed any setting?** You must **Redeploy** for it to take effect.
