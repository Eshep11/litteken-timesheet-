"use client";

import { UserButton } from "@clerk/nextjs";

export default function TopBar({ name, role }) {
  return (
    <div className="topbar no-print">
      <div className="topbar-title">Litteken Plumbing — Time Sheets</div>
      <div className="topbar-right">
        {name && (
          <span className="auth-label">
            {name}
            {role === "boss" && <span className="role-badge">Boss</span>}
          </span>
        )}
        <UserButton afterSignOutUrl="/sign-in" />
      </div>
    </div>
  );
}
