"use server";

import { auth } from "@clerk/nextjs/server";
import {
  getUser,
  upsertTimesheet,
  createWeek as dbCreateWeek,
  deleteWeek as dbDeleteWeek,
} from "@/lib/db";
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

export async function deleteWeekAction(ownerId, weekStart) {
  await authorizeFor(ownerId);
  await dbDeleteWeek(ownerId, weekStart);
  revalidatePath("/");
  return { ok: true };
}
