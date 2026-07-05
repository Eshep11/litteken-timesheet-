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
  initialWeeks,
  initialWeek,
  initialSheet,
  isOwner,
}) {
  const [weeks, setWeeks] = useState(initialWeeks);
  const [selectedWeek, setSelectedWeek] = useState(initialWeek);
  const [employee, setEmployee] = useState(initialSheet.employee || "");
  const [rows, setRows] = useState(
    initialSheet.data && initialSheet.data.length
      ? initialSheet.data
      : emptyRows(20)
  );
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  // ── Load a different week ──
  async function selectWeek(week) {
    if (week === selectedWeek) return;
    if (dirty && !confirm("You have unsaved changes. Switch weeks anyway?")) {
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      const res = await fetch(`/api/timesheet?week=${week}`);
      const sheet = await res.json();
      setSelectedWeek(week);
      setEmployee(sheet.employee || "");
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
    setBusy(true);
    setStatus("Saving…");
    try {
      await saveTimesheet(selectedWeek, employee, rows);
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
      await createWeekAction(monday);
      setWeeks((w) => [monday, ...w].sort().reverse());
      setSelectedWeek(monday);
      setEmployee("");
      setRows(emptyRows(20));
      setDirty(false);
      setStatus("");
    } catch {
      setStatus("Could not create the week — are you still signed in?");
    } finally {
      setBusy(false);
    }
  }

  // ── Delete week ──
  async function removeWeek() {
    if (
      !confirm(
        `Delete the timesheet for the week of ${weekLabel(selectedWeek)}? This cannot be undone.`
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await deleteWeekAction(selectedWeek);
      const remaining = weeks.filter((w) => w !== selectedWeek);
      setWeeks(remaining);
      const next = remaining[0] || currentMonday();
      setSelectedWeek(next);
      const res = await fetch(`/api/timesheet?week=${next}`);
      const sheet = await res.json();
      setEmployee(sheet.employee || "");
      setRows(sheet.data && sheet.data.length ? sheet.data : emptyRows(20));
      setDirty(false);
    } catch {
      setStatus("Could not delete — are you still signed in?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="layout">
      {/* ── Week list ── */}
      <aside className="weeklist no-print">
        <div className="weeklist-head">
          <span>Time sheets</span>
          {isOwner && (
            <button className="btn btn-small" onClick={newWeek} disabled={busy}>
              + New
            </button>
          )}
        </div>
        <div className="weeklist-scroll">
          {weeks.length === 0 && (
            <div className="weeklist-empty">
              No timesheets yet.
              {isOwner ? ' Tap "+ New" to start one.' : ""}
            </div>
          )}
          {weeks.map((w) => (
            <button
              key={w}
              className={
                "weeklist-item" + (w === selectedWeek ? " active" : "")
              }
              onClick={() => selectWeek(w)}
              disabled={busy}
            >
              <span className="weeklist-week">Week of</span>
              <span className="weeklist-date">{weekLabel(w)}</span>
            </button>
          ))}
        </div>
      </aside>

      {/* ── Sheet + controls ── */}
      <section className="content">
        <div className="controls no-print">
          <div className="controls-left">
            <strong>Week of {weekLabel(selectedWeek)}</strong>
            {dirty && <span className="badge-dirty">Unsaved changes</span>}
            {status && <span className="status">{status}</span>}
          </div>
          <div className="controls-right">
            <button className="btn" onClick={() => window.print()}>
              Download / Print
            </button>
            {isOwner && (
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

        {!isOwner && (
          <div className="viewer-note no-print">
            View only. The timesheet updates automatically when the owner saves
            changes.
          </div>
        )}

        <TimesheetGrid
          employee={employee}
          rows={rows}
          editable={isOwner}
          onEmployeeChange={updateEmployee}
          onCellChange={updateCell}
        />
      </section>
    </div>
  );
}
