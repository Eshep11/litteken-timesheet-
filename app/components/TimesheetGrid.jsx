"use client";

import { isRowEmpty } from "@/lib/rows";

export default function TimesheetGrid({
  employee,
  rows,
  editable,
  onEmployeeChange,
  onCellChange,
}) {
  return (
    <div className="sheet" id="printable">
      {/* ── Letterhead ── */}
      <div className="sheet-header">
        <div className="sheet-header-left">
          2952 Trico Dr.
          <br />
          Trenton, IL 62293
        </div>
        <div className="sheet-header-logo">
          <img src="/litteken-logo.png" alt="Litteken Plumbing Co., Inc." />
        </div>
        <div className="sheet-header-right">
          www.littekenplumbing.com
          <br />
          (618) 224-2249
        </div>
      </div>

      <div className="services-bar">
        <span>Residential</span>
        <span>Commercial</span>
        <span>Remodeling</span>
        <span>Repair</span>
        <span>Backflow Testing</span>
        <span>Sewer Cleaning &amp; Replacement</span>
        <span>High Pressure Jetting</span>
        <span>Camera &amp; Video Services</span>
      </div>

      <div className="employee-line">
        Employee:&nbsp;
        <input
          type="text"
          value={employee}
          readOnly={!editable}
          onChange={(e) => onEmployeeChange(e.target.value)}
        />
      </div>

      <div className="notice">
        **Prior to arriving on a job site for the 1st time or when filling out
        your time-sheet, verify with Chad the correct{" "}
        <u>Contractor name and job name</u>. All commercial jobs, most new
        residential homes and some miscellaneous jobs will have both, a
        contractor name and a job name. Service calls and non-contractor jobs
        must have a <u>First and Last Name</u>. Partial job names are not
        acceptable**
      </div>
      <div className="notice">
        **If a customer pays on site, the payment information must be completed.
      </div>

      {/* ── Table view (desktop + print) ── */}
      <div className="sheet-table-view">
        <div className="grid-scroll">
          <table className="timesheet">
            <colgroup>
              <col className="c-date" />
              <col className="c-contr" />
              <col className="c-job" />
              <col className="c-reg" />
              <col className="c-ot" />
              <col className="c-dt" />
              <col className="c-desc" />
              <col className="c-pay" />
              <col className="c-ptype" />
              <col className="c-pmeth" />
            </colgroup>
            <thead>
              <tr className="th-top">
                <th rowSpan={2}>Date</th>
                <th rowSpan={2}>Contractor</th>
                <th rowSpan={2}>Job Name</th>
                <th colSpan={3} className="th-hours">
                  Hours
                </th>
                <th rowSpan={2}>Work Description</th>
                <th>Payment</th>
                <th>Payment</th>
                <th>Payment Type</th>
              </tr>
              <tr className="th-sub">
                <th>Reg</th>
                <th>OT</th>
                <th>DT</th>
                <th>
                  Did
                  <br />
                  Customer
                  <br />
                  pay? Y/N
                </th>
                <th>
                  Partial
                  <br />
                  Pymt (P)
                  <br />
                  OR Full
                  <br />
                  Pymt (F)
                </th>
                <th>
                  Check#, C.C.,
                  <br />
                  Cash
                  <br />
                  &amp; Amount Pd
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td><Cell v={row.date} ro={!editable} onChange={(x) => onCellChange(i, "date", x)} /></td>
                  <td><Cell v={row.contractor} ro={!editable} align="left" onChange={(x) => onCellChange(i, "contractor", x)} /></td>
                  <td><Cell v={row.job} ro={!editable} align="left" onChange={(x) => onCellChange(i, "job", x)} /></td>
                  <td><Cell v={row.reg} ro={!editable} onChange={(x) => onCellChange(i, "reg", x)} /></td>
                  <td><Cell v={row.ot} ro={!editable} onChange={(x) => onCellChange(i, "ot", x)} /></td>
                  <td><Cell v={row.dt} ro={!editable} onChange={(x) => onCellChange(i, "dt", x)} /></td>
                  <td><Cell v={row.desc} ro={!editable} align="left" onChange={(x) => onCellChange(i, "desc", x)} /></td>
                  <td><Cell v={row.paid} ro={!editable} onChange={(x) => onCellChange(i, "paid", x)} /></td>
                  <td><Cell v={row.partialFull} ro={!editable} onChange={(x) => onCellChange(i, "partialFull", x)} /></td>
                  <td><Cell v={row.payType} ro={!editable} align="left" onChange={(x) => onCellChange(i, "payType", x)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Card view (phones only) ── */}
      <div className="sheet-card-view">
        <CardList rows={rows} editable={editable} onCellChange={onCellChange} />
      </div>
    </div>
  );
}

function CardList({ rows, editable, onCellChange }) {
  // Show every filled entry plus one blank entry to fill next (when editing).
  // When view-only (boss), show just the filled entries.
  let lastFilled = -1;
  rows.forEach((r, i) => {
    if (!isRowEmpty(r)) lastFilled = i;
  });
  const visibleCount = editable
    ? Math.min(rows.length, Math.max(lastFilled + 2, 1))
    : lastFilled + 1;
  const visible = rows.slice(0, Math.max(visibleCount, 0));

  if (!editable && visible.length === 0) {
    return <div className="cards-empty">No entries for this week yet.</div>;
  }

  return (
    <div className="cards">
      {visible.map((row, i) => (
        <div className="entry-card" key={i}>
          <div className="entry-card-head">
            <span>Entry {i + 1}</span>
            {(row.date || row.job) && (
              <span className="entry-card-summary">
                {[row.date, row.job].filter(Boolean).join(" · ")}
              </span>
            )}
          </div>

          <label className="field">
            <span>Date</span>
            <input type="text" inputMode="text" value={row.date || ""} readOnly={!editable}
              onChange={(e) => onCellChange(i, "date", e.target.value)} placeholder="e.g. 7/6" />
          </label>

          <label className="field">
            <span>Contractor</span>
            <input type="text" value={row.contractor || ""} readOnly={!editable}
              onChange={(e) => onCellChange(i, "contractor", e.target.value)} />
          </label>

          <label className="field">
            <span>Job Name</span>
            <input type="text" value={row.job || ""} readOnly={!editable}
              onChange={(e) => onCellChange(i, "job", e.target.value)} />
          </label>

          <div className="field-group hours-group">
            <label className="field">
              <span>Reg</span>
              <input type="text" inputMode="decimal" value={row.reg || ""} readOnly={!editable}
                onChange={(e) => onCellChange(i, "reg", e.target.value)} />
            </label>
            <label className="field">
              <span>OT</span>
              <input type="text" inputMode="decimal" value={row.ot || ""} readOnly={!editable}
                onChange={(e) => onCellChange(i, "ot", e.target.value)} />
            </label>
            <label className="field">
              <span>DT</span>
              <input type="text" inputMode="decimal" value={row.dt || ""} readOnly={!editable}
                onChange={(e) => onCellChange(i, "dt", e.target.value)} />
            </label>
          </div>

          <label className="field">
            <span>Work Description</span>
            <textarea rows={2} value={row.desc || ""} readOnly={!editable}
              onChange={(e) => onCellChange(i, "desc", e.target.value)} />
          </label>

          <div className="field-group">
            <label className="field">
              <span>Customer paid?</span>
              <select value={row.paid || ""} disabled={!editable}
                onChange={(e) => onCellChange(i, "paid", e.target.value)}>
                <option value=""></option>
                <option value="Y">Yes</option>
                <option value="N">No</option>
              </select>
            </label>
            <label className="field">
              <span>Partial / Full</span>
              <select value={row.partialFull || ""} disabled={!editable}
                onChange={(e) => onCellChange(i, "partialFull", e.target.value)}>
                <option value=""></option>
                <option value="P">Partial</option>
                <option value="F">Full</option>
              </select>
            </label>
          </div>

          <label className="field">
            <span>Payment (Check#, C.C., Cash &amp; Amount Pd)</span>
            <input type="text" value={row.payType || ""} readOnly={!editable}
              onChange={(e) => onCellChange(i, "payType", e.target.value)} />
          </label>
        </div>
      ))}
    </div>
  );
}

function Cell({ v, ro, align, onChange }) {
  return (
    <input
      type="text"
      className={align === "left" ? "cell left" : "cell"}
      value={v || ""}
      readOnly={ro}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
