export function downloadJson(data: unknown, fileName: string): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

export function exportFileName(now: Date = new Date()): string {
  return `betng-account-data-${now.toISOString().slice(0, 10)}.json`;
}
