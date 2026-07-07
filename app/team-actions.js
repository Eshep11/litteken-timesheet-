"use server";

import { auth } from "@clerk/nextjs/server";
import { getUser, deleteUserAndData } from "@/lib/db";
import { revalidatePath } from "next/cache";

// Confirm the caller is a boss; returns their user record or throws.
async function requireBoss() {
  const { userId } = await auth();
  if (!userId) throw new Error("Not signed in");
  const me = await getUser(userId);
  if (!me || me.role !== "boss") throw new Error("Not authorized");
  return me;
}

// Remove an employee: deletes their access (users row) and all their
// timesheets. Their Clerk login remains but is locked out at the code screen.
export async function removeEmployee(employeeId) {
  const me = await requireBoss();
  if (!employeeId || employeeId === me.clerk_id) {
    throw new Error("Invalid target");
  }
  await deleteUserAndData(employeeId);
  revalidatePath("/");
  return { ok: true };
}

// Return the access code for a given role, so a boss can build an invite.
// Only bosses can read the codes.
export async function getAccessCode(role) {
  await requireBoss();
  const code =
    role === "boss"
      ? process.env.BOSS_CODE || ""
      : process.env.EMPLOYEE_CODE || "";
  return { code };
}
