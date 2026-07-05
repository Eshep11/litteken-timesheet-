"use client";

import { useActionState, useState } from "react";
import { login, logout } from "@/app/auth-actions";

export default function AuthControls({ isEditor }) {
  if (isEditor) {
    return (
      <form action={logout}>
        <span className="auth-label">Editing unlocked</span>
        <button className="btn btn-ghost" type="submit">
          Lock editing
        </button>
      </form>
    );
  }
  return <LoginBox />;
}

function LoginBox() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(login, null);

  if (!open) {
    return (
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        Unlock editing
      </button>
    );
  }

  return (
    <form action={formAction} className="loginbox">
      <input
        type="password"
        name="password"
        placeholder="Edit password"
        autoFocus
        className="login-input"
      />
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "…" : "Unlock"}
      </button>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => setOpen(false)}
      >
        Cancel
      </button>
      {state && !state.ok && (
        <span className="login-error">{state.error}</span>
      )}
    </form>
  );
}
