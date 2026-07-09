"use client";

import { useState, useEffect } from "react";
import { currentMonday, mondayOf, weekLabel, formatDateTime } from "@/lib/dates";

export default function TeamStatus({ open, onClose }) {
  const [week, setWeek] = useState(currentMonday());
  const [dateInput, setDateInput] = useState(currentMonday());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [employees, setEmployees] = useState(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(`/api/team-status?week=${week}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) setError("Could not load status.");
        else setEmployees(data.employees || []);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load status.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, week]);

  if (!open) return null;

  function applyDate() {
    try {
      setWeek(mondayOf(dateInput));
    } catch {
      // ignore bad input; keep previous week
    }
  }

  const submitted = (employees || []).filter((e) => e.submitted_at);
  const notSubmitted = (employees || []).filter((e) => !e.submitted_at);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 className="modal-title">Weekly status</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="status-week-picker">
          <input
            type="date"
            className="date-input"
            value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
          />
          <button className="btn btn-small" onClick={applyDate}>
            Go
          </button>
        </div>
        <p className="modal-hint">Showing week of {weekLabel(week)}. Managers aren't included below.</p>

        {error && <div className="modal-error">{error}</div>}
        {loading && <p className="modal-hint">Loading…</p>}

        {!loading && employees && (
          <>
            <div className="modal-section">
              <div className="modal-section-title">
                Not submitted yet ({notSubmitted.length})
              </div>
              {notSubmitted.length === 0 ? (
                <p className="modal-hint">Everyone has submitted for this week.</p>
              ) : (
                <ul className="team-list">
                  {notSubmitted.map((e) => (
                    <li key={e.clerk_id} className="team-item">
                      <div className="team-person">
                        <span className="team-name">{e.name}</span>
                        <span className="team-email">{e.email}</span>
                      </div>
                      <span className="status-pill status-pending">Not submitted</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="modal-section">
              <div className="modal-section-title">Submitted ({submitted.length})</div>
              {submitted.length === 0 ? (
                <p className="modal-hint">No one has submitted yet.</p>
              ) : (
                <ul className="team-list">
                  {submitted.map((e) => (
                    <li key={e.clerk_id} className="team-item">
                      <div className="team-person">
                        <span className="team-name">{e.name}</span>
                        <span className="team-email">{formatDateTime(e.submitted_at)}</span>
                      </div>
                      <span className="status-pill status-done">✓ Submitted</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
