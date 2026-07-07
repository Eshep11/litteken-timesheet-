"use client";

import { useState, useEffect } from "react";
import TimesheetGrid from "./TimesheetGrid";
import TeamManager from "./TeamManager";
import { weekLabel, mondayOf, currentMonday, todayLocal } from "@/lib/dates";
import { emptyRows, emptyRow, isRowEmpty } from "@/lib/rows";
import {
  saveTimesheet,
  createWeekAction,
  deleteWeekAction,
} from "@/app/actions";

export default function TimesheetApp({
  isBoss,
  employees,
  ownerId,
  ownerName,
  initialWeeks,
  initialWeek,
  initialSheet,
}) {
  const [employeeList, setEmployeeList] = useState(employees || []);
  const [owner, setOwner] = useState({ id: ownerId, name: ownerName });
  const [weeks, setWeeks] = useState(initialWeeks);
  const [selectedWeek, setSelectedWeek] = useState(initialWeek);
  const [employee, setEmployee] = useState(
    initialSheet.employee || ownerName || ""
  );
  const [rows, setRows] = useState(
    initialSheet.data && initialSheet.data.length
      ? initialSheet.data
      : emptyRows(20)
  );
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [showTeam, setShowTeam] = useState(false);
  const [showNewWeek, setShowNewWeek] = useState(false);

  // Bosses are view-only. Only an employee editing their own sheet can edit.
  const canEdit = !isBoss && !!owner.id;

  // Warn before closing/leaving the page with unsaved changes.
  useEffect(() => {
    function warn(e) {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // Week hour totals (shown on screen only; the printed sheet stays
  // identical to the paper form).
  const totals = rows.reduce(
    (acc, r) => {
      acc.reg += parseFloat(r.reg) || 0;
      acc.ot += parseFloat(r.ot) || 0;
      acc.dt += parseFloat(r.dt) || 0;
      return acc;
    },
    { reg: 0, ot: 0, dt: 0 }
  );
  const fmt = (n) => parseFloat(n.toFixed(2));

  // ── Boss: switch which employee we're viewing ──
  async function selectEmployee(empId) {
    const emp = employeeList.find((e) => e.clerk_id === empId);
    if (!emp || emp.clerk_id === owner.id) return;
    if (dirty && !confirm("You have unsaved changes. Switch anyway?")) return;
    setBusy(true);
    setStatus("");
    try {
      const wr = await fetch(`/api/weeks?owner=${empId}`);
      const { weeks: newWeeks } = await wr.json();
      const first = newWeeks[0] || currentMonday();
      const sr = await fetch(`/api/timesheet?owner=${empId}&week=${first}`);
      const sheet = await sr.json();
      setOwner({ id: emp.clerk_id, name: emp.name });
      setWeeks(newWeeks);
      setSelectedWeek(first);
      setEmployee(sheet.employee || emp.name);
      setRows(sheet.data && sheet.data.length ? sheet.data : emptyRows(20));
      setDirty(false);
    } catch {
      setStatus("Could not load that employee.");
    } finally {
      setBusy(false);
    }
  }

  // ── Boss: an employee was removed ──
  function handleRemoved(id) {
    const remaining = employeeList.filter((e) => e.clerk_id !== id);
    setEmployeeList(remaining);
    if (owner.id === id) {
      if (remaining.length) {
        // Load the first remaining employee.
        setOwner({ id: null, name: "" }); // reset so selectEmployee runs
        selectEmployee(remaining[0].clerk_id);
      } else {
        setOwner({ id: null, name: "" });
        setWeeks([]);
        setSelectedWeek(currentMonday());
        setEmployee("");
        setRows(emptyRows(20));
      }
    }
  }

  // ── Load a different week ──
  async function selectWeek(week) {
    if (week === selectedWeek || !owner.id) return;
    if (dirty && !confirm("You have unsaved changes. Switch weeks anyway?")) return;
    setBusy(true);
    setStatus("");
    try {
      const res = await fetch(`/api/timesheet?owner=${owner.id}&week=${week}`);
      const sheet = await res.json();
      setSelectedWeek(week);
      setEmployee(sheet.employee || owner.name);
      setRows(sheet.data && sheet.data.length ? sheet.data : emptyRows(20));
      setDirty(false);
    } catch {
      setStatus("Could not load that week.");
    } finally {
      setBusy(false);
    }
  }

  // ── Edits ──
  function updateEmployee(v) {
    setEmployee(v);
    setDirty(true);
  }
  function updateCell(i, field, v) {
    setRows((prev) => {
      const next = prev.slice();
      next[i] = { ...next[i], [field]: v };
      if (!isRowEmpty(next[next.length - 1])) next.push(emptyRow());
      return next;
    });
    setDirty(true);
  }
  function addRows(n = 5) {
    setRows((prev) => [...prev, ...emptyRows(n)]);
    setDirty(true);
  }

  // ── Save ──
  async function save() {
    if (!owner.id) return;
    setBusy(true);
    setStatus("Saving…");
    try {
      await saveTimesheet(owner.id, owner.name, selectedWeek, employee, rows);
      if (!weeks.includes(selectedWeek)) {
        setWeeks((w) => [selectedWeek, ...w].sort().reverse());
      }
      setDirty(false);
      setStatus("Saved.");
      setTimeout(() => setStatus(""), 2000);
    } catch {
      setStatus("Save failed — are you still signed in?");
    } finally {
      setBusy(false);
    }
  }

  // ── New week (date-picker modal; snaps any picked date to its Monday) ──
  function newWeek() {
    if (!owner.id) return;
    setShowNewWeek(true);
  }

  async function createWeekFor(dateStr) {
    setShowNewWeek(false);
    if (!owner.id || !dateStr) return;
    let monday;
    try {
      monday = mondayOf(dateStr.trim());
    } catch {
      monday = "";
    }
    if (!monday || monday.includes("NaN")) {
      alert("That date didn't look right. Please pick a date.");
      return;
    }
    if (weeks.includes(monday)) {
      selectWeek(monday);
      return;
    }
    setBusy(true);
    setStatus("Creating week…");
    try {
      await createWeekAction(owner.id, owner.name, monday);
      setWeeks((w) => [monday, ...w].sort().reverse());
      setSelectedWeek(monday);
      setEmployee(owner.name);
      setRows(emptyRows(20));
      setDirty(false);
      setStatus("");
    } catch {
      setStatus("Could not create the week.");
    } finally {
      setBusy(false);
    }
  }

  // ── Delete week ──
  async function removeWeek() {
    if (!owner.id) return;
    if (
      !confirm(
        `Delete the timesheet for the week of ${weekLabel(selectedWeek)}? This cannot be undone.`
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await deleteWeekAction(owner.id, selectedWeek);
      const remaining = weeks.filter((w) => w !== selectedWeek);
      setWeeks(remaining);
      const next = remaining[0] || currentMonday();
      setSelectedWeek(next);
      const res = await fetch(`/api/timesheet?owner=${owner.id}&week=${next}`);
      const sheet = await res.json();
      setEmployee(sheet.employee || owner.name);
      setRows(sheet.data && sheet.data.length ? sheet.data : emptyRows(20));
      setDirty(false);
    } catch {
      setStatus("Could not delete.");
    } finally {
      setBusy(false);
    }
  }

  const hasSheet = !!owner.id;

  return (
    <div>
      {isBoss && (
        <div className="boss-bar no-print">
          {employeeList.length > 0 && (
            <>
              <label className="boss-label">Viewing employee:</label>
              <select
                className="boss-select"
                value={owner.id || ""}
                onChange={(e) => selectEmployee(e.target.value)}
                disabled={busy}
              >
                {employeeList.map((e) => (
                  <option key={e.clerk_id} value={e.clerk_id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </>
          )}
          <button className="btn btn-small manage-team-btn" onClick={() => setShowTeam(true)}>
            Manage team
          </button>
        </div>
      )}

      {hasSheet && (
        <div className="week-dropdown no-print">
          <label className="week-dropdown-label">Time sheet:</label>
          <select
            className="week-dropdown-select"
            value={selectedWeek}
            onChange={(e) => selectWeek(e.target.value)}
            disabled={busy}
          >
            {weeks.length === 0 && <option value={selectedWeek}>This week (new)</option>}
            {weeks.map((w) => (
              <option key={w} value={w}>
                Week of {weekLabel(w)}
              </option>
            ))}
          </select>
          {canEdit && (
            <button className="btn btn-small" onClick={newWeek} disabled={busy}>
              + New
            </button>
          )}
        </div>
      )}

      {!hasSheet ? (
        <div className="empty-state">
          {isBoss
            ? 'No employees have signed up yet. Use "Manage team" above to invite your crew — once they create an account with the employee code, they\'ll appear here.'
            : "Loading your timesheet…"}
        </div>
      ) : (
        <div className="layout">
          <aside className="weeklist no-print">
            <div className="weeklist-head">
              <span>Time sheets</span>
              {canEdit && (
                <button className="btn btn-small" onClick={newWeek} disabled={busy}>
                  + New
                </button>
              )}
            </div>
            <div className="weeklist-scroll">
              {weeks.length === 0 && (
                <div className="weeklist-empty">
                  No timesheets yet.
                  {canEdit ? ' Tap "+ New" to start one.' : ""}
                </div>
              )}
              {weeks.map((w) => (
                <button
                  key={w}
                  className={"weeklist-item" + (w === selectedWeek ? " active" : "")}
                  onClick={() => selectWeek(w)}
                  disabled={busy}
                >
                  <span className="weeklist-week">Week of</span>
                  <span className="weeklist-date">{weekLabel(w)}</span>
                </button>
              ))}
            </div>
          </aside>

          <section className="content">
            <div className="controls no-print">
              <div className="controls-left">
                <strong>Week of {weekLabel(selectedWeek)}</strong>
                {isBoss && owner.name && (
                  <span className="owner-chip">{owner.name}</span>
                )}
                {(totals.reg > 0 || totals.ot > 0 || totals.dt > 0) && (
                  <span className="totals-chip">
                    Reg {fmt(totals.reg)} · OT {fmt(totals.ot)} · DT {fmt(totals.dt)}
                  </span>
                )}
                {dirty && <span className="badge-dirty">Unsaved changes</span>}
                {status && <span className="status">{status}</span>}
              </div>
              <div className="controls-right">
                <button className="btn" onClick={() => window.print()}>
                  Download / Print
                </button>
                {canEdit && (
                  <>
                    <button className="btn hide-mobile" onClick={() => addRows(5)} disabled={busy}>
                      + 5 rows
                    </button>
                    <button
                      className="btn btn-primary hide-mobile"
                      onClick={save}
                      disabled={busy || !dirty}
                    >
                      Save
                    </button>
                    <button className="btn btn-danger" onClick={removeWeek} disabled={busy}>
                      Delete week
                    </button>
                  </>
                )}
              </div>
            </div>

            {isBoss && (
              <div className="viewer-note no-print">
                View only — you're reviewing {owner.name}&apos;s timesheet. Only
                the employee can edit their own hours. You can print or download
                it.
              </div>
            )}

            <TimesheetGrid
              employee={employee}
              rows={rows}
              editable={canEdit}
              onEmployeeChange={updateEmployee}
              onCellChange={updateCell}
            />
          </section>
        </div>
      )}

      {canEdit && (
        <div className="mobile-actionbar no-print">
          <button className="btn" onClick={() => window.print()}>
            Print
          </button>
          <button
            className="btn btn-primary actionbar-save"
            onClick={save}
            disabled={busy || !dirty}
          >
            {busy ? "Saving…" : dirty ? "Save changes" : "Saved"}
          </button>
        </div>
      )}

      {showNewWeek && (
        <NewWeekModal
          onCancel={() => setShowNewWeek(false)}
          onCreate={createWeekFor}
        />
      )}

      {isBoss && (
        <TeamManager
          open={showTeam}
          employees={employeeList}
          onClose={() => setShowTeam(false)}
          onRemoved={handleRemoved}
        />
      )}
    </div>
  );
}

function NewWeekModal({ onCancel, onCreate }) {
  const [date, setDate] = useState(todayLocal());
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal modal-narrow" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 className="modal-title">New time sheet</h2>
          <button className="modal-close" onClick={onCancel} aria-label="Close">
            ×
          </button>
        </div>
        <p className="modal-hint">
          Pick any day in the week you want — it will snap to that week
          automatically.
        </p>
        <input
          type="date"
          className="date-input"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <div className="modal-actions">
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={() => onCreate(date)}>
            Create week
          </button>
        </div>
      </div>
    </div>
  );
}
