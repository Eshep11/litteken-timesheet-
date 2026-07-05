"use client";

import { useState } from "react";
import TimesheetGrid from "./TimesheetGrid";
import { weekLabel, mondayOf, currentMonday } from "@/lib/dates";
import { emptyRows } from "@/lib/rows";
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

  const canEdit = !!owner.id;

  // ── Boss: switch which employee we're viewing ──
  async function selectEmployee(empId) {
    const emp = employees.find((e) => e.clerk_id === empId);
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

  // ── New week ──
  async function newWeek() {
    if (!owner.id) return;
    const input = prompt(
      "New timesheet — enter any date in that week (YYYY-MM-DD):",
      currentMonday()
    );
    if (!input) return;
    let monday;
    try {
      monday = mondayOf(input.trim());
    } catch {
      alert("That date didn't look right. Use the format YYYY-MM-DD.");
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

  // ── Boss with no employees yet ──
  if (isBoss && employees.length === 0) {
    return (
      <div className="empty-state">
        No employees have signed up yet. Once they create an account with the
        employee code, they'll appear here and you'll be able to view and edit
        their timesheets.
      </div>
    );
  }

  return (
    <div>
      {isBoss && (
        <div className="boss-bar no-print">
          <label className="boss-label">Viewing employee:</label>
          <select
            className="boss-select"
            value={owner.id || ""}
            onChange={(e) => selectEmployee(e.target.value)}
            disabled={busy}
          >
            {employees.map((e) => (
              <option key={e.clerk_id} value={e.clerk_id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
      )}

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
              {dirty && <span className="badge-dirty">Unsaved changes</span>}
              {status && <span className="status">{status}</span>}
            </div>
            <div className="controls-right">
              <button className="btn" onClick={() => window.print()}>
                Download / Print
              </button>
              {canEdit && (
                <>
                  <button className="btn" onClick={() => addRows(5)} disabled={busy}>
                    + 5 rows
                  </button>
                  <button
                    className="btn btn-primary"
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

          <TimesheetGrid
            employee={employee}
            rows={rows}
            editable={canEdit}
            onEmployeeChange={updateEmployee}
            onCellChange={updateCell}
          />
        </section>
      </div>
    </div>
  );
}
