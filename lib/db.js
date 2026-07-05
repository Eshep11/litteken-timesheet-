import { neon } from "@neondatabase/serverless";

// Lazily create the SQL client so importing this module never throws
// during build when DATABASE_URL isn't set yet.
function db() {
  return neon(process.env.DATABASE_URL);
}

// Create the table once per cold start (idempotent).
let schemaPromise;
function ensureSchema() {
  if (!schemaPromise) {
    const sql = db();
    schemaPromise = sql`
      CREATE TABLE IF NOT EXISTS timesheets (
        id         serial PRIMARY KEY,
        week_start date UNIQUE NOT NULL,
        employee   text NOT NULL DEFAULT '',
        data       jsonb NOT NULL DEFAULT '[]'::jsonb,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `;
  }
  return schemaPromise;
}

// Return every week that has a timesheet, newest first, as "YYYY-MM-DD" strings.
export async function getWeeks() {
  await ensureSchema();
  const sql = db();
  const rows = await sql`
    SELECT to_char(week_start, 'YYYY-MM-DD') AS week_start
    FROM timesheets
    ORDER BY week_start DESC
  `;
  return rows.map((r) => r.week_start);
}

// Return one timesheet, or null if that week doesn't exist yet.
export async function getTimesheet(weekStart) {
  await ensureSchema();
  const sql = db();
  const rows = await sql`
    SELECT to_char(week_start, 'YYYY-MM-DD') AS week_start, employee, data
    FROM timesheets
    WHERE week_start = ${weekStart}
  `;
  return rows[0] || null;
}

// Create or update a timesheet for a given week.
export async function upsertTimesheet(weekStart, employee, data) {
  await ensureSchema();
  const sql = db();
  await sql`
    INSERT INTO timesheets (week_start, employee, data, updated_at)
    VALUES (${weekStart}, ${employee}, ${JSON.stringify(data)}, now())
    ON CONFLICT (week_start)
    DO UPDATE SET employee = EXCLUDED.employee,
                  data = EXCLUDED.data,
                  updated_at = now()
  `;
}

// Create an empty week (no-op if it already exists).
export async function createWeek(weekStart) {
  await ensureSchema();
  const sql = db();
  await sql`
    INSERT INTO timesheets (week_start)
    VALUES (${weekStart})
    ON CONFLICT (week_start) DO NOTHING
  `;
}

// Delete a week's timesheet.
export async function deleteWeek(weekStart) {
  await ensureSchema();
  const sql = db();
  await sql`DELETE FROM timesheets WHERE week_start = ${weekStart}`;
}
