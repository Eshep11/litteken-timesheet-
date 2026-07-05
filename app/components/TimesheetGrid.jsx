"use client";

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

      {/* ── Grid ── */}
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
                <td>
                  <Cell v={row.date} ro={!editable} onChange={(x) => onCellChange(i, "date", x)} />
                </td>
                <td>
                  <Cell v={row.contractor} ro={!editable} align="left" onChange={(x) => onCellChange(i, "contractor", x)} />
                </td>
                <td>
                  <Cell v={row.job} ro={!editable} align="left" onChange={(x) => onCellChange(i, "job", x)} />
                </td>
                <td>
                  <Cell v={row.reg} ro={!editable} onChange={(x) => onCellChange(i, "reg", x)} />
                </td>
                <td>
                  <Cell v={row.ot} ro={!editable} onChange={(x) => onCellChange(i, "ot", x)} />
                </td>
                <td>
                  <Cell v={row.dt} ro={!editable} onChange={(x) => onCellChange(i, "dt", x)} />
                </td>
                <td>
                  <Cell v={row.desc} ro={!editable} align="left" onChange={(x) => onCellChange(i, "desc", x)} />
                </td>
                <td>
                  <Cell v={row.paid} ro={!editable} onChange={(x) => onCellChange(i, "paid", x)} />
                </td>
                <td>
                  <Cell v={row.partialFull} ro={!editable} onChange={(x) => onCellChange(i, "partialFull", x)} />
                </td>
                <td>
                  <Cell v={row.payType} ro={!editable} align="left" onChange={(x) => onCellChange(i, "payType", x)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
