"use server";

import { revalidatePath } from "next/cache";
import { setEditorCookie, clearEditorCookie } from "@/lib/session";

// Called from the login form. Checks the password against EDIT_PASSWORD and,
// if it matches, sets the signed editor cookie.
export async function login(_prevState, formData) {
  const password = String(formData.get("password") || "");
  const expected = process.env.EDIT_PASSWORD || "";
  if (expected && password === expected) {
    await setEditorCookie();
    revalidatePath("/");
    return { ok: true };
  }
  return { ok: false, error: "Incorrect password." };
}

export async function logout() {
  await clearEditorCookie();
  revalidatePath("/");
  return { ok: true };
}
