"use client";

import { useActionState } from "react";
import { submitAccessCode } from "@/app/access-actions";

export default function AccessCodeGate() {
  const [state, formAction, pending] = useActionState(submitAccessCode, null);

  return (
    <div className="gate">
      <div className="gate-card">
        <h1 className="gate-title">One more step</h1>
        <p className="gate-text">
          Enter your name and the access code you were given. The code decides
          whether you're set up as an employee or a manager.
        </p>
        <form action={formAction} className="gate-form">
          <label className="gate-label">
            Your name
            <input
              type="text"
              name="name"
              placeholder="e.g. Dave Reynolds"
              className="gate-input"
              autoFocus
            />
          </label>
          <label className="gate-label">
            Access code
            <input
              type="text"
              name="code"
              placeholder="Enter your code"
              className="gate-input"
            />
          </label>
          <button className="btn btn-primary gate-submit" type="submit" disabled={pending}>
            {pending ? "Checking…" : "Continue"}
          </button>
          {state && !state.ok && (
            <span className="gate-error">{state.error}</span>
          )}
        </form>
      </div>
    </div>
  );
}
