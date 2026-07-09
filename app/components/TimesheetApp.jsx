"use client";

import { useState, useEffect } from "react";
import TimesheetGrid from "./TimesheetGrid";
import TeamManager from "./TeamManager";
import TeamStatus from "./TeamStatus";
import {
  weekLabel,
  mondayOf,
  currentMonday,
  todayLocal,
  formatDateTime,
  deadlineLabel,
} from "@/lib/dates";
import { isLocked } from "@/lib/lock";
import { emptyRows, emptyRow, isRowEmpty } from "@/lib/rows";
import {
  saveTimesheet,
  createWeekAction,
  deleteWeekAction,
  submitTimesheetAction,
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
  const [weeks, setWeeks] = useState(initialWeeks); // [{week_start, submitted_at}]
  const [selectedWeek, setSelectedWeek] = useState(initialWeek);
  const [employee, setEmployee] = useState(
    initialSheet.employee || ownerName || ""
  );
  const [rows, setRows] = useState(
    initialSheet.data && initialSheet.data.length
      ? initialSheet.data
      : emptyRows(20)
  );
  const [createdAt, setCreatedAt] = useState(initialSheet.created_at || null);
  const [submittedAt, setSubmittedAt] = useState(initialSheet.submitted_at || null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [showTeam, setShowTeam] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [showNewWeek, setShowNewWeek] = useState(false);

  const locked = isLocked(selectedWeek, submittedAt);
  // Bosses are view-only. Employees can edit only their own, unlocked sheet.
  const canEdit = !isBoss && !!owner.id && !locked;

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

  // Week hour totals (screen only; the printed sheet stays identical to the
  // paper form).
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

  function applySheet(sheet, fallbackName) {
    setEmployee(sheet.employee || fallbackName || "");
    setRows(sheet.data && sheet.data.length ? sheet.data : emptyRows(20));
    setCreatedAt(sheet.created_at || null);
    setSubmittedAt(sheet.submitted_at || null);
  }

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
      const first = (newWeeks[0] && newWeeks[0].week_start) || currentMonday();
      const sr = await fetch(`/api/timesheet?owner=${empId}&week=${first}`);
      const sheet = await sr.json();
      setOwner({ id: emp.clerk_id, name: emp.name });
      setWeeks(newWeeks);
      setSelectedWeek(first);
      applySheet(sheet, emp.name);
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
        setOwner({ id: null, name: "" });
        selectEmployee(remaining[0].clerk_id);
      } else {
        setOwner({ id: null, name: "" });
        setWeeks([]);
        setSelectedWeek(currentMonday());
        setEmployee("");
        setRows(emptyRows(20));
        setCreatedAt(null);
        setSubmittedAt(null);
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
      applySheet(sheet, owner.name);
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
    if (!owner.id || locked) return;
    setBusy(true);
    setStatus("Saving…");
    try {
      await saveTimesheet(owner.id, owner.name, selectedWeek, employee, rows);
      if (!weeks.some((w) => w.week_start === selectedWeek)) {
        setWeeks((w) => [{ week_start: selectedWeek, submitted_at: null }, ...w]);
      }
      if (!createdAt) setCreatedAt(new Date().toISOString());
      setDirty(false);
      setStatus("Saved.");
      setTimeout(() => setStatus(""), 2000);
    } catch {
      setStatus("Save failed — are you still signed in?");
    } finally {
      setBusy(false);
    }
  }

  // ── Submit (locks the sheet) ──
  async function submit() {
    if (!owner.id || locked) return;
    if (
      !confirm(
        "Submit this timesheet? You won't be able to edit it after this.\n\n" +
          "(If you submit by mistake, you can still delete the week and start over.)"
      )
    ) {
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      // Make sure the latest edits are saved before locking them in.
      if (dirty) {
        await saveTimesheet(owner.id, owner.name, selectedWeek, employee, rows);
        setDirty(false);
      }
      await submitTimesheetAction(owner.id, selectedWeek);
      const nowIso = new Date().toISOString();
      setSubmittedAt(nowIso);
      if (!weeks.some((w) => w.week_start === selectedWeek)) {
        setWeeks((w) => [{ week_start: selectedWeek, submitted_at: nowIso }, ...w]);
      } else {
        setWeeks((w) =>
          w.map((wk) =>
            wk.week_start === selectedWeek ? { ...wk, submitted_at: nowIso } : wk
          )
        );
      }
      setStatus("Submitted.");
      setTimeout(() => setStatus(""), 2500);
    } catch {
      setStatus("Could not submit. Are you still signed in?");
    } finally {
      setBusy(false);
    }
  }

  // ── New week ──
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
    if (weeks.some((w) => w.week_start === monday)) {
      selectWeek(monday);
      return;
    }
    setBusy(true);
    setStatus("Creating week…");
    try {
      await createWeekAction(owner.id, owner.name, monday);
      setWeeks((w) => [{ week_start: monday, submitted_at: null }, ...w]);
      setSelectedWeek(monday);
      setEmployee(owner.name);
      setRows(emptyRows(20));
      setCreatedAt(new Date().toISOString());
      setSubmittedAt(null);
      setDirty(false);
      setStatus("");
    } catch {
      setStatus("Could not create the week.");
    } finally {
      setBusy(false);
    }
  }

  // ── Delete week (allowed even when locked — the accidental-submit fix) ──
  async function removeWeek() {
    if (!owner.id) return;
    const msg = locked
      ? `Delete the timesheet for the week of ${weekLabel(selectedWeek)}? It's locked/submitted, but you can still delete it and start over. This cannot be undone.`
      : `Delete the timesheet for the week of ${weekLabel(selectedWeek)}? This cannot be undone.`;
    if (!confirm(msg)) return;
    setBusy(true);
    try {
      await deleteWeekAction(owner.id, selectedWeek);
      const remaining = weeks.filter((w) => w.week_start !== selectedWeek);
      setWeeks(remaining);
      const next = (remaining[0] && remaining[0].week_start) || currentMonday();
      setSelectedWeek(next);
      const res = await fetch(`/api/timesheet?owner=${owner.id}&week=${next}`);
      const sheet = await res.json();
      applySheet(sheet, owner.name);
      setDirty(false);
    } catch {
      setStatus("Could not delete.");
    } finally {
      setBusy(false);
    }
  }

  const hasSheet = !!owner.id;
  const statusInfo = {
    createdLabel: formatDateTime(createdAt),
    submittedLabel: formatDateTime(submittedAt),
    locked,
    deadlineText: deadlineLabel(selectedWeek),
  };

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
          <button className="btn btn-small" onClick={() => setShowStatus(true)}>
            Weekly status
          </button>
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
              <option key={w.week_start} value={w.week_start}>
                Week of {weekLabel(w.week_start)}
                {w.submitted_at ? " ✓" : ""}
              </option>
            ))}
          </select>
          {!isBoss && (
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
              {!isBoss && (
                <button className="btn btn-small" onClick={newWeek} disabled={busy}>
                  + New
                </button>
              )}
            </div>
            <div className="weeklist-scroll">
              {weeks.length === 0 && (
                <div className="weeklist-empty">
                  No timesheets yet.
                  {!isBoss ? ' Tap "+ New" to start one.' : ""}
                </div>
              )}
              {weeks.map((w) => (
                <button
                  key={w.week_start}
                  className={
                    "weeklist-item" + (w.week_start === selectedWeek ? " active" : "")
                  }
                  onClick={() => selectWeek(w.week_start)}
                  disabled={busy}
                >
                  <span className="weeklist-week">
                    Week of
                    {w.submitted_at && <span className="weeklist-check">✓</span>}
                  </span>
                  <span className="weeklist-date">{weekLabel(w.week_start)}</span>
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
                {submittedAt && <span className="submitted-chip">✓ Submitted</span>}
                {!submittedAt && locked && (
                  <span className="locked-chip">Locked — deadline passed</span>
                )}
                {dirty && <span className="badge-dirty">Unsaved changes</span>}
                {status && <span className="status">{status}</span>}
              </div>
              <div className="controls-right">
                <button className="btn" onClick={() => window.print()}>
                  Download / Print
                </button>
                {!isBoss && owner.id && (
                  <>
                    {!locked && (
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
                        <button
                          className="btn btn-submit"
                          onClick={submit}
                          disabled={busy}
                          title="Submit this timesheet — locks it from further edits"
                        >
                          Submit
                        </button>
                      </>
                    )}
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
              statusInfo={statusInfo}
            />
          </section>
        </div>
      )}

      {!isBoss && hasSheet && !locked && (
        <div className="mobile-actionbar no-print">
          <button className="btn" onClick={() => window.print()}>
            Print
          </button>
          <button className="btn btn-submit-mobile" onClick={submit} disabled={busy}>
            Submit
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
      {!isBoss && hasSheet && locked && (
        <div className="mobile-actionbar no-print">
          <button className="btn actionbar-save" onClick={() => window.print()}>
            Print
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

      {isBoss && <TeamStatus open={showStatus} onClose={() => setShowStatus(false)} />}
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
