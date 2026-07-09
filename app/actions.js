"use server";

import { auth } from "@clerk/nextjs/server";
import {
  getUser,
  getTimesheet,
  upsertTimesheet,
  createWeek as dbCreateWeek,
  deleteWeek as dbDeleteWeek,
  submitTimesheet as dbSubmitTimesheet,
} from "@/lib/db";
import { isLocked } from "@/lib/lock";
import { revalidatePath } from "next/cache";

// Work out who's calling and whether they may WRITE to `ownerId`'s sheets.
// Only the employee who owns a sheet may edit it. Bosses are view-only —
// they can review and print, but cannot change anyone's hours. This keeps
// the timesheet an honest record authored only by the person who worked.
async function authorizeFor(ownerId) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not signed in");
  const me = await getUser(userId);
  if (!me) throw new Error("No access yet");
  if (me.clerk_id === ownerId) return me;
  throw new Error("Not authorized");
}

export async function saveTimesheet(ownerId, ownerName, weekStart, employee, rows) {
  await authorizeFor(ownerId);
  // Re-check the lock on the server — never trust the client's idea of
  // whether a sheet is still editable. Once submitted, or once the
  // Wednesday deadline has passed, edits are rejected here even if someone
  // bypasses the UI.
  const existing = await getTimesheet(ownerId, weekStart);
  if (existing && isLocked(weekStart, existing.submitted_at)) {
    throw new Error("This timesheet is locked and can no longer be edited.");
  }
  await upsertTimesheet(ownerId, ownerName, weekStart, employee, rows);
  revalidatePath("/");
  return { ok: true };
}

export async function createWeekAction(ownerId, ownerName, weekStart) {
  await authorizeFor(ownerId);
  await dbCreateWeek(ownerId, ownerName, weekStart);
  revalidatePath("/");
  return { ok: true };
}

// Delete stays allowed even on a locked/submitted sheet — this is the
// employee's recovery path if they submit by accident. The created/updated
// timestamps on any sheet that replaces it still show the manager when it
// was really made, so this isn't a silent rewrite of history.
export async function deleteWeekAction(ownerId, weekStart) {
  await authorizeFor(ownerId);
  await dbDeleteWeek(ownerId, weekStart);
  revalidatePath("/");
  return { ok: true };
}

// Submit locks the sheet going forward. Only the owning employee may submit
// their own sheet (bosses can't submit on someone's behalf).
export async function submitTimesheetAction(ownerId, weekStart) {
  await authorizeFor(ownerId);
  const existing = await getTimesheet(ownerId, weekStart);
  if (!existing) {
    throw new Error("Save some hours before submitting.");
  }
  if (isLocked(weekStart, existing.submitted_at)) {
    // Already locked (submitted earlier, or deadline passed) — treat as a
    // harmless no-op rather than an error.
    return { ok: true, alreadyLocked: true };
  }
  await dbSubmitTimesheet(ownerId, weekStart);
  revalidatePath("/");
  return { ok: true };
}
