import { neon } from "@neondatabase/serverless";

// Lazily create the SQL client so importing this module never throws
// during build when DATABASE_URL isn't set yet.
function db() {
  return neon(process.env.DATABASE_URL);
}

// Create tables once per cold start (idempotent).
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
          id         serial PRIMARY KEY,
          owner_id   text NOT NULL,
          owner_name text NOT NULL DEFAULT '',
          week_start date NOT NULL,
          employee   text NOT NULL DEFAULT '',
          data       jsonb NOT NULL DEFAULT '[]'::jsonb,
          updated_at timestamptz NOT NULL DEFAULT now(),
          UNIQUE (owner_id, week_start)
        )
      `;
    })();
  }
  return schemaPromise;
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

// All employees (for the boss view), newest name order.
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

export async function getWeeks(ownerId) {
  await ensureSchema();
  const sql = db();
  const rows = await sql`
    SELECT to_char(week_start, 'YYYY-MM-DD') AS week_start
    FROM timesheets
    WHERE owner_id = ${ownerId}
    ORDER BY week_start DESC
  `;
  return rows.map((r) => r.week_start);
}

export async function getTimesheet(ownerId, weekStart) {
  await ensureSchema();
  const sql = db();
  const rows = await sql`
    SELECT to_char(week_start, 'YYYY-MM-DD') AS week_start, employee, data
    FROM timesheets
    WHERE owner_id = ${ownerId} AND week_start = ${weekStart}
  `;
  return rows[0] || null;
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
