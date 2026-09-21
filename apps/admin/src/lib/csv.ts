type Cell = string | number;

/* A leading =, +, - or @ would run as a formula when the file is opened in a spreadsheet. */
function escapeCell(cell: Cell): string {
  if (typeof cell === "number") return String(cell);

  const guarded = /^[=+\-@\t\r]/.test(cell) ? `'${cell}` : cell;

  return `"${guarded.replace(/"/g, '""')}"`;
}

export function toCsv(header: readonly string[], rows: readonly (readonly Cell[])[]): string {
  return [header, ...rows].map((row) => row.map(escapeCell).join(",")).join("\n");
}

export function downloadCsv(filename: string, header: readonly string[], rows: readonly (readonly Cell[])[]): void {
  const url = URL.createObjectURL(new Blob([toCsv(header, rows)], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
