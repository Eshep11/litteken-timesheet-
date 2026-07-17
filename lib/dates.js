// Local "YYYY-MM-DD" for today (no UTC shift).
export function todayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Given "YYYY-MM-DD", return the Monday of that week as "YYYY-MM-DD".
export function mondayOf(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay(); // 0 = Sun .. 6 = Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function currentMonday() {
  return mondayOf(todayLocal());
}

// Human label, e.g. "Mon, Jul 6, 2026".
export function weekLabel(weekStart) {
  const d = new Date(weekStart + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// The submit deadline for a given week: Wednesday of the FOLLOWING week.
// weekStart is a Monday "YYYY-MM-DD". Monday + 9 days = the Wednesday
// nine days later (next Monday +2). Editable through end of that day.
export function submitDeadline(weekStart) {
  const d = new Date(weekStart + "T00:00:00");
  d.setDate(d.getDate() + 9);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// Human label for the deadline, e.g. "Wed, Jul 15".
export function deadlineLabel(weekStart) {
  const d = new Date(submitDeadline(weekStart) + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// Format an ISO timestamp for display, e.g. "Jul 6, 9:12 AM".
export function formatDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Bump a hand-typed date like "7/6" or "7/6/2026" forward one day, keeping
// the same style the person used ("7/6" stays year-less: "7/7"; month
// rollover works: "7/31" -> "8/1"). Used by the Duplicate-entry feature.
// If the text isn't a recognizable date, return it unchanged — better to
// copy what they wrote than to mangle it.
export function bumpDate(text) {
  const s = String(text || "").trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!m) return s;
  const month = parseInt(m[1], 10);
  const day = parseInt(m[2], 10);
  let year = m[3] ? parseInt(m[3], 10) : new Date().getFullYear();
  if (year < 100) year += 2000;
  const d = new Date(year, month - 1, day);
  if (isNaN(d.getTime())) return s;
  d.setDate(d.getDate() + 1);
  const out = `${d.getMonth() + 1}/${d.getDate()}`;
  if (!m[3]) return out;
  // Preserve the year style they used (2-digit vs 4-digit).
  const yy = m[3].length <= 2 ? String(d.getFullYear()).slice(-2) : String(d.getFullYear());
  return `${out}/${yy}`;
}
