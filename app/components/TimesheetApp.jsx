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
  bumpDate,
} from "@/lib/dates";
import { isLocked, isPastDeadline } from "@/lib/lock";
import { emptyRows, emptyRow, isRowEmpty } from "@/lib/rows";
import {
  saveTimesheet,
  createWeekAction,
  deleteWeekAction,
  submitTimesheetAction,
  sendBackAction,
  savePhotoAction,
  clearPhotoAction,
  addContractorAction,
} from "@/app/actions";

export default function TimesheetApp({
  isBoss,
  employees,
  ownerId,
  ownerName,
  initialWeeks,
  initialWeek,
  initialSheet,
  initialContractors,
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
  const [photo, setPhoto] = useState(initialSheet.photo || null);
  const [contractors, setContractors] = useState(initialContractors || []);
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
    setPhoto(sheet.photo || null);
  }

  // ── Boss: switch which employee we're viewing ──
  async function selectEmployee(empId) {
    const emp = employeeList.find((e) => e.clerk_id === empId);
    if (!emp || emp.clerk_id === owner.id) return;
    if (!(await handleLeavingCurrentSheet())) return;
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

  // ── Boss: an employee's name was corrected ──
  function handleRenamed(id, newName) {
    setEmployeeList((list) =>
      list.map((e) => (e.clerk_id === id ? { ...e, name: newName } : e))
    );
    if (owner.id === id) {
      setOwner((o) => ({ ...o, name: newName }));
    }
  }

  // Before navigating away from the current sheet (switching week or
  // employee), make sure nothing is lost. If the current viewer can edit
  // and has unsaved changes, save for real rather than just warning. Only
  // falls back to "discard?" if that save fails (e.g. offline).
  // Returns true if it's safe to proceed with the navigation.
  async function handleLeavingCurrentSheet() {
    if (!dirty) return true;
    if (canEdit) {
      setStatus("Saving…");
      const ok = await saveNow();
      if (ok) return true;
      return confirm(
        "Could not save your changes (check your connection). Switch anyway and lose them?"
      );
    }
    return confirm("You have unsaved changes. Switch anyway?");
  }

  // ── Load a different week ──
  async function selectWeek(week) {
    if (week === selectedWeek || !owner.id) return;
    if (!(await handleLeavingCurrentSheet())) return;
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

  // ── Duplicate an entry (for multi-day jobs) ──
  // Copies entry i into a new entry right after it, with the date bumped
  // forward one day ("7/6" -> "7/7", month rollover handled). Everything
  // else — contractor, job, hours, description, payment — carries over.
  function duplicateEntry(i) {
    setRows((prev) => {
      const src = prev[i];
      if (!src) return prev;
      const copy = { ...src, date: bumpDate(src.date) };
      const next = [...prev.slice(0, i + 1), copy, ...prev.slice(i + 1)];
      if (!isRowEmpty(next[next.length - 1])) next.push(emptyRow());
      return next;
    });
    setDirty(true);
    setStatus("Entry duplicated.");
    setTimeout(() => setStatus(""), 2000);
  }

  // Desktop convenience: duplicate the last filled entry.
  function duplicateLast() {
    let last = -1;
    rows.forEach((r, i) => {
      if (!isRowEmpty(r)) last = i;
    });
    if (last >= 0) duplicateEntry(last);
  }

  // ── Save a contractor to the employee's own list (for autocomplete) ──
  async function saveContractor(name) {
    const clean = String(name || "").trim();
    if (!owner.id || clean.length < 2) return;
    // Already saved (case-insensitive)? Nothing to do.
    if (contractors.some((c) => c.toLowerCase() === clean.toLowerCase())) {
      setStatus("Already saved.");
      setTimeout(() => setStatus(""), 1500);
      return;
    }
    try {
      await addContractorAction(owner.id, clean);
      setContractors((list) =>
        [...list, clean].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
      );
      setStatus(`Saved "${clean}" for next time.`);
      setTimeout(() => setStatus(""), 2500);
    } catch {
      setStatus("Could not save that contractor.");
    }
  }

  // ── Photo timesheet upload ──
  // Shrink the photo on the phone before sending: big camera photos are
  // 3–8MB, which is slow on jobsite signal and heavy for the database.
  // Resized to max 1600px JPEG it's typically 200–400KB and still easily
  // readable. Runs entirely in the browser via a canvas.
  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("read failed"));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("not an image"));
        img.onload = () => {
          const MAX = 1600;
          let { width, height } = img;
          if (width > MAX || height > MAX) {
            const scale = MAX / Math.max(width, height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          canvas.getContext("2d").drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.72));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function handlePhotoPicked(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = ""; // allow re-picking the same file later
    if (!file || !owner.id || locked) return;
    setBusy(true);
    setStatus("Uploading photo…");
    try {
      const dataUrl = await compressImage(file);
      await savePhotoAction(owner.id, owner.name, selectedWeek, dataUrl);
      setPhoto(dataUrl);
      if (!weeks.some((w) => w.week_start === selectedWeek)) {
        setWeeks((w) => [{ week_start: selectedWeek, submitted_at: null }, ...w]);
      }
      if (!createdAt) setCreatedAt(new Date().toISOString());
      setDirty(false);
      setStatus("Photo saved as this week's timesheet.");
      setTimeout(() => setStatus(""), 3000);
    } catch {
      setStatus("Could not save that photo — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto() {
    if (!owner.id || locked || !photo) return;
    if (!confirm("Remove the photo and fill out the timesheet manually instead?")) return;
    setBusy(true);
    setStatus("");
    try {
      await clearPhotoAction(owner.id, selectedWeek);
      setPhoto(null);
      setStatus("Photo removed.");
      setTimeout(() => setStatus(""), 2000);
    } catch {
      setStatus("Could not remove the photo.");
    } finally {
      setBusy(false);
    }
  }

  // ── Save (core; returns true/false so callers — the button and the
  // auto-save-before-switching path — can react without duplicating logic) ──
  async function saveNow() {
    if (!owner.id || locked) return false;
    try {
      await saveTimesheet(owner.id, owner.name, selectedWeek, employee, rows);
      if (!weeks.some((w) => w.week_start === selectedWeek)) {
        setWeeks((w) => [{ week_start: selectedWeek, submitted_at: null }, ...w]);
      }
      if (!createdAt) setCreatedAt(new Date().toISOString());
      setDirty(false);
      return true;
    } catch {
      return false;
    }
  }

  async function save() {
    setBusy(true);
    setStatus("Saving…");
    const ok = await saveNow();
    setStatus(ok ? "Saved." : "Save failed — are you still signed in?");
    setBusy(false);
    if (ok) setTimeout(() => setStatus(""), 2000);
  }

  // ── Submit (locks the sheet) ──
  async function submit() {
    if (!owner.id || locked) return;
    const noHours = !photo && totals.reg === 0 && totals.ot === 0 && totals.dt === 0;
    const message = noHours
      ? "This timesheet has no hours entered. Submit anyway? You won't be able to edit it after this.\n\n" +
        "(If you submit by mistake, you can still delete the week and start over.)"
      : "Submit this timesheet? You won't be able to edit it after this.\n\n" +
        "(If you submit by mistake, you can still delete the week and start over.)";
    if (!confirm(message)) return;
    setBusy(true);
    setStatus("");
    try {
      // Make sure the latest edits are saved before locking them in.
      if (dirty) {
        const ok = await saveNow();
        if (!ok) {
          setStatus("Could not save your changes — try again before submitting.");
          setBusy(false);
          return;
        }
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

  // ── Manager: send a submitted sheet back for edits ──
  async function sendBack() {
    if (!isBoss || !owner.id || !submittedAt) return;
    const deadlinePassed = isPastDeadline(selectedWeek);
    const warn = deadlinePassed
      ? `Send ${owner.name}'s timesheet back for edits? Note: this week's deadline has already passed, so let them know right away if they need to fix something.`
      : `Send ${owner.name}'s timesheet back for edits? They'll be able to make changes and re-submit.`;
    if (!confirm(warn)) return;
    setBusy(true);
    setStatus("");
    try {
      const res = await sendBackAction(owner.id, selectedWeek);
      setSubmittedAt(null);
      setWeeks((w) =>
        w.map((wk) =>
          wk.week_start === selectedWeek ? { ...wk, submitted_at: null } : wk
        )
      );
      setStatus(
        res.stillLocked
          ? "Sent back, but the deadline has passed — follow up with them soon."
          : "Sent back for edits."
      );
      setTimeout(() => setStatus(""), 4000);
    } catch {
      setStatus("Could not send back. Are you still signed in?");
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
                {isBoss && owner.id && submittedAt && (
                  <button
                    className="btn btn-small"
                    onClick={sendBack}
                    disabled={busy}
                    title="Unlocks this week so the employee can fix and re-submit it"
                  >
                    Send back for edits
                  </button>
                )}
                {!isBoss && owner.id && (
                  <>
                    {!locked && (
                      <>
                        {!photo && (
                          <>
                            <button className="btn hide-mobile" onClick={duplicateLast} disabled={busy}
                              title="Copy the last entry to a new one with the next day's date">
                              Duplicate last entry
                            </button>
                            <button className="btn hide-mobile" onClick={() => addRows(5)} disabled={busy}>
                              + 5 rows
                            </button>
                          </>
                        )}
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
                {submittedAt && ' Use "Send back for edits" if they need to fix something.'}
              </div>
            )}

            {/* ── Photo timesheet controls (employee, unlocked) ── */}
            {!isBoss && owner.id && !locked && (
              <div className="photo-row no-print">
                {!photo ? (
                  <label className="btn photo-upload-btn">
                    📷 Use a photo instead
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoPicked}
                      hidden
                    />
                  </label>
                ) : (
                  <button className="btn" onClick={removePhoto} disabled={busy}>
                    Remove photo &amp; fill out manually
                  </button>
                )}
                {!photo && (
                  <span className="photo-hint">
                    Snap a picture of a paper timesheet — it becomes your sheet
                    for this week.
                  </span>
                )}
              </div>
            )}

            <TimesheetGrid
              employee={employee}
              rows={rows}
              editable={canEdit}
              onEmployeeChange={updateEmployee}
              onCellChange={updateCell}
              onDuplicate={duplicateEntry}
              statusInfo={statusInfo}
              photo={photo}
              contractors={contractors}
              onSaveContractor={saveContractor}
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
          onRenamed={handleRenamed}
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
