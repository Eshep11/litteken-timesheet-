import { neon } from "@neondatabase/serverless";

// Lazily create the SQL client so importing this module never throws
// during build when DATABASE_URL isn't set yet.
function db() {
  return neon(process.env.DATABASE_URL);
}

// Create tables once per cold start (idempotent). ALTER ... ADD COLUMN IF
// NOT EXISTS safely upgrades an existing database that was created before
// these columns existed, without touching any existing data.
let schemaPromise;
function ensureSchema() {
  if (!schemaPromise) {
    const sql = db();
    schemaPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          clerk_id   text PRIMARY KEY,
          email      text NOT NULL DEFAULT '',
          name       text NOT NULL DEFAULT '',
          role       text NOT NULL DEFAULT 'employee',
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS timesheets (
          id           serial PRIMARY KEY,
          owner_id     text NOT NULL,
          owner_name   text NOT NULL DEFAULT '',
          week_start   date NOT NULL,
          employee     text NOT NULL DEFAULT '',
          data         jsonb NOT NULL DEFAULT '[]'::jsonb,
          created_at   timestamptz NOT NULL DEFAULT now(),
          updated_at   timestamptz NOT NULL DEFAULT now(),
          submitted_at timestamptz,
          UNIQUE (owner_id, week_start)
        )
      `;
      // Upgrade path for databases created before submit/timestamps existed.
      await sql`ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now()`;
      await sql`ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS submitted_at timestamptz`;
      // A photo of a paper/handwritten timesheet, stored as a compressed
      // JPEG data-URL. When present, it IS the timesheet for that week.
      await sql`ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS photo text`;
    })();
  }
  return schemaPromise;
}

// Neon returns timestamptz columns as JS Date objects; normalize to ISO
// strings so the value is identical whether it travels as a Server
// Component prop or as JSON from an API route.
function toIso(v) {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

// ── Users ──

export async function getUser(clerkId) {
  await ensureSchema();
  const sql = db();
  const rows = await sql`SELECT clerk_id, email, name, role FROM users WHERE clerk_id = ${clerkId}`;
  return rows[0] || null;
}

export async function upsertUser(clerkId, email, name, role) {
  await ensureSchema();
  const sql = db();
  await sql`
    INSERT INTO users (clerk_id, email, name, role)
    VALUES (${clerkId}, ${email}, ${name}, ${role})
    ON CONFLICT (clerk_id)
    DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name
  `;
  // Note: we intentionally don't overwrite role on conflict, so an existing
  // user can't change their own role by re-submitting a code.
}

// Let a manager correct a garbled or misspelled employee name.
export async function updateUserName(clerkId, name) {
  await ensureSchema();
  const sql = db();
  await sql`UPDATE users SET name = ${name} WHERE clerk_id = ${clerkId}`;
}

// All employees (for the boss view), name order.
export async function getEmployees() {
  await ensureSchema();
  const sql = db();
  const rows = await sql`
    SELECT clerk_id, name, email FROM users
    WHERE role = 'employee'
    ORDER BY name ASC
  `;
  return rows;
}

// ── Timesheets ──

// Every week this owner has, newest first, with its submitted status so the
// UI can show a submitted indicator without a second round trip.
export async function getWeeks(ownerId) {
  await ensureSchema();
  const sql = db();
  const rows = await sql`
    SELECT to_char(week_start, 'YYYY-MM-DD') AS week_start, submitted_at
    FROM timesheets
    WHERE owner_id = ${ownerId}
    ORDER BY week_start DESC
  `;
  return rows.map((r) => ({ week_start: r.week_start, submitted_at: toIso(r.submitted_at) }));
}

export async function getTimesheet(ownerId, weekStart) {
  await ensureSchema();
  const sql = db();
  const rows = await sql`
    SELECT to_char(week_start, 'YYYY-MM-DD') AS week_start, employee, data,
           created_at, submitted_at, photo
    FROM timesheets
    WHERE owner_id = ${ownerId} AND week_start = ${weekStart}
  `;
  const row = rows[0];
  if (!row) return null;
  return { ...row, created_at: toIso(row.created_at), submitted_at: toIso(row.submitted_at) };
}
export async function upsertTimesheet(ownerId, ownerName, weekStart, employee, data) {
  await ensureSchema();
  const sql = db();
  await sql`
    INSERT INTO timesheets (owner_id, owner_name, week_start, employee, data, updated_at)
    VALUES (${ownerId}, ${ownerName}, ${weekStart}, ${employee}, ${JSON.stringify(data)}, now())
    ON CONFLICT (owner_id, week_start)
    DO UPDATE SET owner_name = EXCLUDED.owner_name,
                  employee = EXCLUDED.employee,
                  data = EXCLUDED.data,
                  updated_at = now()
  `;
}

export async function createWeek(ownerId, ownerName, weekStart) {
  await ensureSchema();
  const sql = db();
  await sql`
    INSERT INTO timesheets (owner_id, owner_name, week_start)
    VALUES (${ownerId}, ${ownerName}, ${weekStart})
    ON CONFLICT (owner_id, week_start) DO NOTHING
  `;
}

export async function deleteWeek(ownerId, weekStart) {
  await ensureSchema();
  const sql = db();
  await sql`DELETE FROM timesheets WHERE owner_id = ${ownerId} AND week_start = ${weekStart}`;
}

// Mark a sheet submitted (locks it). Only sets it the first time — if it's
// already submitted this is a harmless no-op, so the original submit time
// is never overwritten.
export async function submitTimesheet(ownerId, weekStart) {
  await ensureSchema();
  const sql = db();
  await sql`
    UPDATE timesheets SET submitted_at = now()
    WHERE owner_id = ${ownerId} AND week_start = ${weekStart} AND submitted_at IS NULL
  `;
}

// Manager "send back for edits" — clears the submitted flag so the employee
// can edit and re-submit. The manager still never edits the content
// themselves; this only hands editing back to the employee.
export async function unsubmitTimesheet(ownerId, weekStart) {
  await ensureSchema();
  const sql = db();
  await sql`
    UPDATE timesheets SET submitted_at = NULL
    WHERE owner_id = ${ownerId} AND week_start = ${weekStart}
  `;
}

// Attach a photo timesheet for the week (creates the week's row if it
// doesn't exist yet). The photo becomes the timesheet for that week.
export async function setPhoto(ownerId, ownerName, weekStart, photo) {
  await ensureSchema();
  const sql = db();
  await sql`
    INSERT INTO timesheets (owner_id, owner_name, week_start, photo, updated_at)
    VALUES (${ownerId}, ${ownerName}, ${weekStart}, ${photo}, now())
    ON CONFLICT (owner_id, week_start)
    DO UPDATE SET photo = EXCLUDED.photo, updated_at = now()
  `;
}

// Remove the photo so the employee can go back to filling out the grid.
export async function clearPhoto(ownerId, weekStart) {
  await ensureSchema();
  const sql = db();
  await sql`
    UPDATE timesheets SET photo = NULL, updated_at = now()
    WHERE owner_id = ${ownerId} AND week_start = ${weekStart}
  `;
}

// Every employee (never managers) with their submission status for one
// specific week — powers the manager's "who hasn't submitted" list.
export async function getTeamStatus(weekStart) {
  await ensureSchema();
  const sql = db();
  const rows = await sql`
    SELECT u.clerk_id, u.name, u.email, t.submitted_at
    FROM users u
    LEFT JOIN timesheets t
      ON t.owner_id = u.clerk_id AND t.week_start = ${weekStart}
    WHERE u.role = 'employee'
    ORDER BY u.name ASC
  `;
  return rows.map((r) => ({ ...r, submitted_at: toIso(r.submitted_at) }));
}
export async function deleteUserAndData(clerkId) {
  await ensureSchema();
  const sql = db();
  await sql`DELETE FROM timesheets WHERE owner_id = ${clerkId}`;
  await sql`DELETE FROM users WHERE clerk_id = ${clerkId}`;
}
