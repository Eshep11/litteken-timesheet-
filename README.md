# Litteken Plumbing — Time Sheets

A simple web app for weekly employee time sheets.

- **Anyone** can open the site and view every timesheet (read-only).
- **Only you** can unlock editing, with one password that only you know.
- Everything is saved to a database, so you see the same sheets on your phone,
  laptop, or anywhere else.
- A **Download / Print** button turns any week into a PDF (Print → "Save as PDF").

Built with Next.js and Neon Postgres. No Google account or OAuth setup needed.
Runs free.

---

## How the login works

There are no user accounts. You set one secret **edit password**. On the site
you click **Unlock editing**, type the password once, and editing turns on (it
stays unlocked on that device for about 30 days via a secure cookie). Everyone
else just sees the sheets — no password, no login, view only.

That's the whole auth system. To "log out," click **Lock editing**.

---

## What you'll set up (about 15–20 min, one time)

1. A **Neon** database — where the timesheets live.
2. **Vercel** — hosts the website and connects to Neon.
3. Two settings: your **edit password** and a random **secret**.

You can test it on your own computer first (Part A) or go straight online
(Part B). Local testing is optional.

---

## Part A — Run it on your computer first (optional)

You need **Node.js** installed. Easiest way on a Mac: download the **LTS**
installer from https://nodejs.org, open the `.pkg`, click through, then quit
and reopen Terminal.

1. In this project folder:
   ```
   npm install
   ```
2. Make your local settings file:
   ```
   cp .env.local.example .env.local
   ```
   (On Windows, just copy `.env.local.example` and rename the copy to
   `.env.local`.)
3. Fill in `.env.local`:
   - `EDIT_PASSWORD` — any password you'll remember.
   - `AUTH_SECRET` — any long random string.
   - `DATABASE_URL` — from Neon (Step 1 below).
4. Start it:
   ```
   npm run dev
   ```
   Open http://localhost:3000

---

## Step 1 — Database (Neon Postgres)

Easiest is to add Neon from inside Vercel (Step 2) — it wires the connection in
automatically. To do it directly instead:

1. Go to **https://neon.tech** → sign up (free, no credit card).
2. **Create a project** (any name, any region near you).
3. Copy the **Connection string** shown on the dashboard. It looks like
   `postgresql://user:pass@ep-xxxx.neon.tech/dbname?sslmode=require`.
4. Use it as `DATABASE_URL`.

The app creates its own table automatically the first time it runs — no SQL to
write.

---

## Step 2 — Put it online (Vercel)

1. Create a free **GitHub** account (https://github.com) and push this project
   to a new repository. If you're not a command-line person, the GitHub Desktop
   app is the easiest way: https://desktop.github.com
2. Go to **https://vercel.com** → sign up with GitHub.
3. **Add New… → Project** → import your repository. Vercel auto-detects
   Next.js; leave the build settings as-is.
4. **Add the database:** your Vercel project → **Storage** tab → **Create
   Database → Neon** → follow the prompts. This sets `DATABASE_URL` for you
   automatically. (Skip Step 1 if you do this.)
5. **Add your two settings:** project → **Settings → Environment Variables**.
   Add:
   - `EDIT_PASSWORD` — the password you'll type to edit.
   - `AUTH_SECRET` — any long random string. Generate one by running
     `npx auth secret` in the project folder, or grab one from
     https://generate-secret.vercel.app
6. **Deploy** (or **Redeploy** if you added the variables after the first
   deploy — variables only take effect on a fresh deploy).
7. Vercel gives you a URL like `https://litteken-timesheet.vercel.app`. That's
   your site. Share it with anyone who needs to view.

Done. Open the site, click **Unlock editing**, type your password, and edit.

---

## Using it

- **Time sheets** list on the left (scrolls). Newest week on top. Tap one to
  view it.
- **Unlock editing** (top right) — type your password once to turn on editing.
- **+ New** — start a timesheet for a week. Type any date in that week; it snaps
  to that week automatically.
- Fill in the grid. **Save** writes it to the database. A yellow "Unsaved
  changes" tag reminds you when something isn't saved yet.
- **+ 5 rows** adds more lines if a week is busy.
- **Download / Print** — opens your browser's print dialog. Choose
  "Save as PDF" for a file, or print it.
- **Delete week** removes that week's sheet.
- **Lock editing** turns editing back off on that device.

Viewers (no password) see everything read-only and can Download / Print any
week.

---

## Costs

Free on Vercel + Neon's free tiers for this kind of low-traffic tool.

One note: Vercel's free **Hobby** plan is officially intended for
non-commercial use. For a small internal tool this is a common gray area. If
you want to be strict, upgrade to Vercel Pro (~$20/mo) or host on Cloudflare
Pages or Netlify (their free tiers allow commercial use). The code runs the
same on all of them.

---

## Common gotchas

- **Password won't unlock:** confirm `EDIT_PASSWORD` is set in Vercel's
  Environment Variables and you **Redeployed** after adding it. Passwords are
  case-sensitive.
- **Unlocks but "Save failed":** usually the cookie/secret. Make sure
  `AUTH_SECRET` is set. Try locking and unlocking again.
- **Database errors:** check `DATABASE_URL` is set and correct in Vercel, then
  Redeploy.
- **Changed any setting?** You must **Redeploy** for it to take effect.
- **Want to change the password later:** update `EDIT_PASSWORD` in Vercel and
  Redeploy. (Anyone currently unlocked stays unlocked until their cookie
  expires; to force everyone out, also change `AUTH_SECRET`.)
