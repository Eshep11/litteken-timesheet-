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
