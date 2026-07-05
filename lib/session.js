import crypto from "crypto";
import { cookies } from "next/headers";

const COOKIE = "lts_editor";

// A token that can only be produced by someone who knows AUTH_SECRET.
// It's stored in the cookie; we recompute and compare on every request, so
// the cookie can't be forged.
function token() {
  const secret = process.env.AUTH_SECRET || "";
  return crypto.createHmac("sha256", secret).update("editor:v1").digest("hex");
}

// True if the current visitor has unlocked editing.
export async function isEditor() {
  const store = await cookies();
  const value = store.get(COOKIE)?.value;
  if (!value) return false;
  const expected = token();
  try {
    return crypto.timingSafeEqual(Buffer.from(value), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function setEditorCookie() {
  const store = await cookies();
  store.set(COOKIE, token(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // http on localhost, https live
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // stay unlocked ~30 days
  });
}

export async function clearEditorCookie() {
  const store = await cookies();
  store.delete(COOKIE);
}
