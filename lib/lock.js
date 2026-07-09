import { todayLocal, submitDeadline } from "./dates";

// True once the submit deadline (Wednesday of the following week) has
// passed, using the caller's local "today".
export function isPastDeadline(weekStart) {
  return todayLocal() > submitDeadline(weekStart);
}

// A timesheet is locked (no longer editable by the employee) once it has
// been submitted, OR once its deadline has passed — whichever comes first.
// This is the single source of truth, used on both the server (real
// enforcement) and the client (UI state), so they never disagree.
export function isLocked(weekStart, submittedAt) {
  if (submittedAt) return true;
  return isPastDeadline(weekStart);
}
