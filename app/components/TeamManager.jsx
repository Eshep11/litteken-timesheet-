"use client";

import { useState } from "react";
import { removeEmployee, getAccessCode } from "@/app/team-actions";

export default function TeamManager({ open, employees, onClose, onRemoved }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [invite, setInvite] = useState(null); // { role, message }
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  async function handleRemove(emp) {
    if (
      !confirm(
        `Remove ${emp.name} from the timesheet app? This deletes their access and all of their timesheets. This cannot be undone.`
      )
    ) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await removeEmployee(emp.clerk_id);
      onRemoved(emp.clerk_id);
    } catch {
      setError("Could not remove that person. Are you still signed in?");
    } finally {
      setBusy(false);
    }
  }

  async function makeInvite(role) {
    setBusy(true);
    setError("");
    setCopied(false);
    try {
      const { code } = await getAccessCode(role);
      if (!code) {
        setError("No access code is set for that role yet.");
        return;
      }
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const who = role === "boss" ? "a manager account" : "an employee account";
      const closing =
        role === "boss"
          ? "Then you can review and print employees' time sheets from your phone or computer."
          : "Then you can fill out your weekly time sheets from your phone or computer.";
      const homeScreenTip =
        `Tip: Tap the Share button and choose "Add to Home Screen" to add ` +
        `your timesheets as an app to your home screen.`;
      const message =
        `You've been invited to the Litteken Plumbing time sheet app.\n\n` +
        `1. Open this link: ${origin}/sign-up\n` +
        `2. Sign up with your email and a password.\n` +
        `3. When it asks for an access code, enter:  ${code}\n` +
        `4. Type your name, and you're in.\n\n` +
        `This sets you up with ${who}. ${closing}\n\n` +
        `${homeScreenTip}`;
      setInvite({ role, message });
    } catch {
      setError("Could not create the invite. Are you still signed in?");
    } finally {
      setBusy(false);
    }
  }

  async function copyInvite() {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard blocked — the text is visible for manual copy.
      setCopied(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 className="modal-title">Manage team</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {error && <div className="modal-error">{error}</div>}

        {/* ── Invite ── */}
        <div className="modal-section">
          <div className="modal-section-title">Invite someone</div>
          <p className="modal-hint">
            Generate a message with the sign-up link and access code, then copy
            and send it by text or email.
          </p>
          <div className="invite-buttons">
            <button className="btn" onClick={() => makeInvite("employee")} disabled={busy}>
              Invite an employee
            </button>
            <button className="btn" onClick={() => makeInvite("boss")} disabled={busy}>
              Invite a manager
            </button>
          </div>

          {invite && (
            <div className="invite-result">
              <textarea className="invite-text" readOnly value={invite.message} rows={9} />
              <div className="invite-actions">
                <button className="btn btn-primary" onClick={copyInvite}>
                  {copied ? "Copied!" : "Copy message"}
                </button>
                <span className="invite-note">
                  {invite.role === "boss" ? "Manager" : "Employee"} invite
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── Employees ── */}
        <div className="modal-section">
          <div className="modal-section-title">Employees</div>
          {employees.length === 0 ? (
            <p className="modal-hint">No employees yet. Use the invite above to add your crew.</p>
          ) : (
            <ul className="team-list">
              {employees.map((e) => (
                <li key={e.clerk_id} className="team-item">
                  <div className="team-person">
                    <span className="team-name">{e.name}</span>
                    <span className="team-email">{e.email}</span>
                  </div>
                  <button
                    className="btn btn-danger btn-small"
                    onClick={() => handleRemove(e)}
                    disabled={busy}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
