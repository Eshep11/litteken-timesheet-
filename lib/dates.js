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
