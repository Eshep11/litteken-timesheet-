"use server";

import { auth } from "@clerk/nextjs/server";
import {
  getUser,
  getTimesheet,
  upsertTimesheet,
  createWeek as dbCreateWeek,
  deleteWeek as dbDeleteWeek,
  submitTimesheet as dbSubmitTimesheet,
  unsubmitTimesheet as dbUnsubmitTimesheet,
  setPhoto as dbSetPhoto,
  clearPhoto as dbClearPhoto,
} from "@/lib/db";
import { isLocked, isPastDeadline } from "@/lib/lock";
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

// Manager "send back for edits" — clears the submitted flag so the employee
// can fix and re-submit their sheet. Manager-only; the manager still never
// edits the content themselves, this just hands editing back to the
// employee. If the Wednesday deadline has already passed, the sheet will
// immediately re-lock from the deadline rule regardless — we report that
// back so the manager knows to follow up with the employee right away.
export async function sendBackAction(ownerId, weekStart) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not signed in");
  const me = await getUser(userId);
  if (!me || me.role !== "boss") throw new Error("Not authorized");

  const existing = await getTimesheet(ownerId, weekStart);
  if (!existing || !existing.submitted_at) {
    return { ok: true, alreadyUnlocked: true, stillLocked: false };
  }
  await dbUnsubmitTimesheet(ownerId, weekStart);
  revalidatePath("/");
  return { ok: true, stillLocked: isPastDeadline(weekStart) };
}

// ── Photo timesheets ──
// An employee can upload a photo of a paper timesheet instead of filling
// out the grid. The photo simply becomes their timesheet for that week.
// Same rules as editing: only the owner, and only while unlocked.

const MAX_PHOTO_CHARS = 3_500_000; // ~2.6MB of image as a data URL

export async function savePhotoAction(ownerId, ownerName, weekStart, photoDataUrl) {
  await authorizeFor(ownerId);
  const existing = await getTimesheet(ownerId, weekStart);
  if (existing && isLocked(weekStart, existing.submitted_at)) {
    throw new Error("This timesheet is locked and can no longer be changed.");
  }
  const photo = String(photoDataUrl || "");
  if (!photo.startsWith("data:image/")) {
    throw new Error("That file doesn't look like a photo.");
  }
  if (photo.length > MAX_PHOTO_CHARS) {
    throw new Error("That photo is too large — please try again.");
  }
  await dbSetPhoto(ownerId, ownerName, weekStart, photo);
  revalidatePath("/");
  return { ok: true };
}

export async function clearPhotoAction(ownerId, weekStart) {
  await authorizeFor(ownerId);
  const existing = await getTimesheet(ownerId, weekStart);
  if (existing && isLocked(weekStart, existing.submitted_at)) {
    throw new Error("This timesheet is locked and can no longer be changed.");
  }
  await dbClearPhoto(ownerId, weekStart);
  revalidatePath("/");
  return { ok: true };
}
