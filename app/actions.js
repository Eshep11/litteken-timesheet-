"use server";

import { isEditor } from "@/lib/session";
import {
  upsertTimesheet,
  createWeek as dbCreateWeek,
  deleteWeek as dbDeleteWeek,
} from "@/lib/db";
import { revalidatePath } from "next/cache";

// Throw unless the visitor has unlocked editing with the password.
// This is the REAL security boundary — the UI just hides buttons.
async function requireEditor() {
  if (!(await isEditor())) {
    throw new Error("Not authorized");
  }
}

export async function saveTimesheet(weekStart, employee, rows) {
  await requireEditor();
  await upsertTimesheet(weekStart, employee, rows);
  revalidatePath("/");
  return { ok: true };
}

export async function createWeekAction(weekStart) {
  await requireEditor();
  await dbCreateWeek(weekStart);
  revalidatePath("/");
  return { ok: true };
}

export async function deleteWeekAction(weekStart) {
  await requireEditor();
  await dbDeleteWeek(weekStart);
  revalidatePath("/");
  return { ok: true };
}
