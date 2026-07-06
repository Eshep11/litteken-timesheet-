export function emptyRow() {
  return {
    date: "",
    contractor: "",
    job: "",
    reg: "",
    ot: "",
    dt: "",
    desc: "",
    paid: "",
    partialFull: "",
    payType: "",
  };
}

export function emptyRows(n = 20) {
  return Array.from({ length: n }, () => emptyRow());
}

export function isRowEmpty(row) {
  if (!row) return true;
  return [
    row.date,
    row.contractor,
    row.job,
    row.reg,
    row.ot,
    row.dt,
    row.desc,
    row.paid,
    row.partialFull,
    row.payType,
  ].every((v) => !v || String(v).trim() === "");
}
