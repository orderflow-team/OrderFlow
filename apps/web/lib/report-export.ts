/** Shared export helpers for report tabs: CSV download and a print-ready (Save as PDF) view. */

export type ExportCell = string | number | null | undefined;

export function csvEscape(value: ExportCell): string {
  let s = value == null ? '' : String(value);
  // Neutralise spreadsheet formula injection from user-entered names/notes.
  if (/^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s))) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildCsv(title: string, headers: string[], rows: ExportCell[][]): string {
  return [csvEscape(title), headers.map(csvEscape).join(','), ...rows.map((r) => r.map(csvEscape).join(','))].join('\n');
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function escapeHtml(value: ExportCell): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Opens a clean printable table; the browser's print dialog offers "Save as PDF". */
export function printReport(title: string, subtitle: string, headers: string[], rows: ExportCell[][]) {
  const w = window.open('', '_blank');
  if (!w) return;
  const head = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
  const body = rows.map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>body{font-family:system-ui,sans-serif;padding:24px;color:#0f172a}h1{font-size:18px;margin:0}p{margin:4px 0 16px;color:#64748b;font-size:12px}
table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left}th{background:#f1f5f9}</style></head>
<body><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`);
  w.document.close();
  w.focus();
  w.print();
}

/** yyyy-mm-dd in the user's local time (toISOString would shift the date across midnight in IST). */
export function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function dateRangePreset(preset: 'today' | 'week' | 'month' | 'lastMonth' | 'fy'): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (preset) {
    case 'today':
      return { from: localDate(now), to: localDate(now) };
    case 'week': {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      return { from: localDate(d), to: localDate(now) };
    }
    case 'month':
      return { from: localDate(new Date(y, m, 1)), to: localDate(now) };
    case 'lastMonth':
      return { from: localDate(new Date(y, m - 1, 1)), to: localDate(new Date(y, m, 0)) };
    case 'fy': {
      const startYear = m >= 3 ? y : y - 1; // Indian FY: 1 Apr – 31 Mar
      return { from: localDate(new Date(startYear, 3, 1)), to: localDate(now) };
    }
  }
}
