"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { getUser, upsertUser } from "@/lib/db";
import { revalidatePath } from "next/cache";

// Called once, right after sign-up. The code decides whether this person
// becomes an employee or a boss. Without a valid code, they get no role and
// can't see or do anything.
export async function submitAccessCode(_prevState, formData) {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "Please sign in first." };

  // If they already have a role, don't let a code change it.
  const existing = await getUser(userId);
  if (existing) {
    revalidatePath("/");
    return { ok: true };
  }

  const name = String(formData.get("name") || "").trim();
  const code = String(formData.get("code") || "").trim();

  if (!name) return { ok: false, error: "Please enter your name." };
  // Require something that actually looks like a name: at least 2
  // characters and at least one letter, so a manager doesn't end up with
  // "asdf" or "1" in their employee list.
  if (name.length < 2 || !/[a-zA-Z]/.test(name)) {
    return { ok: false, error: "Please enter your full name." };
  }
  if (name.length > 60) {
    return { ok: false, error: "That name is too long." };
  }

  const employeeCode = process.env.EMPLOYEE_CODE || "";
  const bossCode = process.env.BOSS_CODE || "";

  let role = null;
  if (bossCode && code === bossCode) role = "boss";
  else if (employeeCode && code === employeeCode) role = "employee";

  if (!role) return { ok: false, error: "That access code isn't valid." };

  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress || "";

  await upsertUser(userId, email, name, role);
  revalidatePath("/");
  return { ok: true };
}
