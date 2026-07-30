'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, Download, Trash2, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import apiClient from '@/lib/api-client';

export interface BulkField {
  /** Key sent to the products API and used as the row's property name. */
  key: string;
  /** Column header shown in the review table (a "*" is appended automatically when required). */
  label: string;
  /** Extra normalized (lowercase, no space/underscore) header names this column should also match in an uploaded CSV. */
  aliases?: string[];
  type?: 'text' | 'number' | 'date' | 'boolean';
  required?: boolean;
  placeholder?: string;
  /** Tailwind width class for the review-table input, e.g. "w-28". */
  width?: string;
  /** Sample value written into the downloadable template CSV. */
  example?: string;
  /** Suggested values shown via a <datalist> on this column's input (e.g. existing categories or units). */
  suggestions?: string[];
}

type BulkRow = Record<string, string>;

interface BulkUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  /** Plural label used in headings and button text, e.g. "Products", "Medicines", "Menu Items". */
  entityLabelPlural: string;
  fields: BulkField[];
  /** Fixed values merged into every row's payload that aren't editable via the CSV (e.g. unit: 'piece'). */
  staticPayload?: Record<string, any>;
  onUploaded: () => void;
}

function normalizeHeader(h: string): string {
  return h
    .replace(/\(.*?\)/g, '') // drop parenthetical annotations like "(INR)", "(Rs.)"
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ''); // collapse spaces, slashes, underscores, punctuation
}

function isBlankValue(v: string): boolean {
  const t = v.trim();
  return t === '' || /^(n\/?a|null|none|-)$/i.test(t);
}

function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    if (row.some((f) => f.trim() !== '')) rows.push(row);
  }
  return rows;
}

function buildAliasMap(fields: BulkField[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const f of fields) {
    map[normalizeHeader(f.key)] = f.key;
    map[normalizeHeader(f.label.replace('*', ''))] = f.key;
    for (const alias of f.aliases || []) {
      map[normalizeHeader(alias)] = f.key;
    }
  }
  return map;
}

function parseBulkCsv(text: string, fields: BulkField[]): { rows: BulkRow[]; error?: string } {
  const table = parseCsvText(text);
  if (table.length === 0) return { rows: [], error: 'The file is empty.' };

  const aliasMap = buildAliasMap(fields);
  const headers = table[0].map(normalizeHeader);
  const fieldOrder = headers.map((h) => aliasMap[h]);
  if (fieldOrder.every((f) => !f)) {
    return { rows: [], error: 'None of the columns were recognized. Download the sample CSV to see the expected format.' };
  }

  const dataRows = table.slice(1);
  if (dataRows.length === 0) return { rows: [], error: 'No data rows found below the header.' };

  // Any column the sheet omits, or leaves blank for a row, is simply left empty here —
  // the review step lets the user fill it in rather than rejecting the row outright.
  const rows: BulkRow[] = dataRows.map((raw) => {
    const rowObj: BulkRow = {};
    fieldOrder.forEach((key, idx) => {
      if (!key) return;
      const value = (raw[idx] ?? '').trim();
      if (!isBlankValue(value)) rowObj[key] = value;
    });
    return rowObj;
  });
  return { rows };
}

function isRowValid(row: BulkRow, fields: BulkField[]): boolean {
  return fields.every((f) => {
    if (!f.required) return true;
    const value = row[f.key];
    if (!value || value.trim() === '') return false;
    if (f.type === 'number' && isNaN(Number(value))) return false;
    return true;
  });
}

function downloadTemplate(fields: BulkField[], filename: string) {
  const header = fields.map((f) => f.key).join(',');
  const example = fields.map((f) => f.example || '').join(',');
  const blob = new Blob([`${header}\n${example}\n`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function BulkUploadDialog({
  open,
  onOpenChange,
  businessId,
  entityLabelPlural,
  fields,
  staticPayload,
  onUploaded,
}: BulkUploadDialogProps) {
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [parseError, setParseError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState<{ success: number; failed: number; errors: string[] } | null>(null);

  const reset = () => {
    setFileName('');
    setRows([]);
    setParseError('');
    setSummary(null);
    setProgress(0);
  };

  const close = () => {
    onOpenChange(false);
    reset();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setSummary(null);
    setFileName(file.name);
    const text = await file.text();
    const { rows: parsed, error } = parseBulkCsv(text, fields);
    if (error) {
      setParseError(error);
      setRows([]);
    } else {
      setParseError('');
      setRows(parsed);
    }
  };

  const updateRow = (index: number, key: string, value: string) => {
    setRows((rs) => rs.map((r, i) => (i === index ? { ...r, [key]: value } : r)));
  };

  const removeRow = (index: number) => {
    setRows((rs) => rs.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!businessId || rows.length === 0) return;
    setUploading(true);
    setProgress(0);
    let success = 0;
    const errors: string[] = [];
    for (const row of rows) {
      const label = row.name || row.brand || '(unnamed row)';
      if (!isRowValid(row, fields)) {
        errors.push(`${label}: missing a required field — skipped`);
        setProgress((p) => p + 1);
        continue;
      }
      const payload: Record<string, any> = { businessId, ...staticPayload };
      for (const f of fields) {
        const value = row[f.key];
        if (value === undefined || value === '') continue;
        if (f.type === 'number') payload[f.key] = Number(value);
        else if (f.type === 'boolean') payload[f.key] = /^(yes|true|1)$/i.test(value);
        else payload[f.key] = value;
      }
      try {
        await apiClient.post('/api/products', payload);
        success++;
      } catch (err: any) {
        errors.push(`${label}: ${err.response?.data?.message || 'Failed to create'}`);
      }
      setProgress((p) => p + 1);
    }
    setUploading(false);
    setSummary({ success, failed: errors.length, errors });
    setRows([]);
    onUploaded();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className={`p-6 max-h-[90vh] overflow-y-auto transition-[max-width] ${rows.length > 0 ? 'sm:max-w-[960px]' : 'sm:max-w-[480px]'}`}>
        <DialogHeader className="mb-2">
          <DialogTitle className="text-xl flex items-center gap-2">
            <Upload className="w-5 h-5 text-tile-lavender-fg" /> Bulk Upload {entityLabelPlural}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 bg-slate-50 rounded-xl p-3 ring-1 ring-slate-200/60">
            <p className="text-xs text-slate-500">
              Upload a CSV with any of these columns:{' '}
              <span className="font-medium text-slate-700">{fields.map((f) => f.key).join(', ')}</span>. Missing columns or blank cells are left empty — you can fill them in below before confirming.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={() => downloadTemplate(fields, `${entityLabelPlural.toLowerCase().replace(/\s+/g, '-')}-bulk-upload-template.csv`)}
            >
              <Download className="w-3.5 h-3.5" /> Sample CSV
            </Button>
          </div>

          {!summary && rows.length === 0 && (
            <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/60 py-8 px-6 cursor-pointer hover:border-tile-lavender-fg/50 hover:bg-slate-50 transition-colors">
              <div className="w-12 h-12 bg-tile-lavender rounded-full flex items-center justify-center">
                <Upload className="w-5 h-5 text-tile-lavender-fg" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-700">{fileName || 'Click to choose a CSV file'}</p>
                <p className="text-xs text-slate-400 mt-0.5">.csv files only</p>
              </div>
              <span className="text-xs font-semibold text-white bg-tile-lavender-fg px-4 py-1.5 rounded-full shadow-sm">Browse Files</span>
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} disabled={uploading} />
            </label>
          )}

          {!summary && !uploading && rows.length > 0 && (
            <div className="flex items-center justify-between gap-3 bg-slate-50 rounded-lg px-3 py-2 ring-1 ring-slate-200/60">
              <span className="text-xs font-medium text-slate-600 truncate">{fileName}</span>
              <label className="text-xs font-medium text-tile-lavender-fg hover:underline cursor-pointer shrink-0">
                Choose a different file
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} disabled={uploading} />
              </label>
            </div>
          )}

          {parseError && <p className="text-sm text-rose-600">{parseError}</p>}

          {rows.length > 0 && !summary && !uploading && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Review before uploading — {rows.filter((r) => isRowValid(r, fields)).length} of {rows.length} rows have all required fields
              </p>
              <div className="max-h-[45vh] overflow-auto rounded-xl ring-1 ring-slate-200/60">
                <table className="w-full text-xs border-collapse" style={{ minWidth: `${fields.length * 110 + 40}px` }}>
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] sticky top-0">
                    <tr>
                      {fields.map((f) => (
                        <th key={f.key} className="px-2 py-2 text-left font-semibold whitespace-nowrap">
                          {f.label}
                          {f.required ? '*' : ''}
                        </th>
                      ))}
                      <th className="px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white/60">
                    {rows.map((row, i) => (
                      <tr key={i}>
                        {fields.map((f) => {
                          const value = row[f.key] || '';
                          const invalid = f.required && (f.type === 'number' ? (value.trim() === '' || isNaN(Number(value))) : value.trim() === '');
                          const cellInput = `h-7 rounded-md border bg-white px-1.5 text-xs outline-none focus:border-tile-lavender-fg/50 ${f.width || 'w-24'} ${invalid ? 'border-rose-300 bg-rose-50' : 'border-slate-200'}`;
                          if (f.type === 'boolean') {
                            return (
                              <td key={f.key} className="p-1">
                                <select value={value} onChange={(e) => updateRow(i, f.key, e.target.value)} className={cellInput}>
                                  <option value="">Default</option>
                                  <option value="yes">Yes</option>
                                  <option value="no">No</option>
                                </select>
                              </td>
                            );
                          }
                          return (
                            <td key={f.key} className="p-1">
                              <input
                                type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                                value={value}
                                onChange={(e) => updateRow(i, f.key, e.target.value)}
                                placeholder={f.required ? 'Required' : f.placeholder}
                                list={f.suggestions ? `bulk-${f.key}-options` : undefined}
                                className={cellInput}
                              />
                            </td>
                          );
                        })}
                        <td className="p-1 text-center">
                          <button type="button" onClick={() => removeRow(i)} className="p-1 text-slate-300 hover:text-rose-600" aria-label="Remove row">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {fields
                  .filter((f) => f.suggestions && f.suggestions.length > 0)
                  .map((f) => (
                    <datalist key={f.key} id={`bulk-${f.key}-options`}>
                      {f.suggestions!.map((s) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                  ))}
              </div>
              <p className="text-[11px] text-slate-400">Rows highlighted in red are missing a required field and will be skipped unless fixed.</p>
            </div>
          )}

          {uploading && (
            <p className="text-sm text-slate-500 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Uploading {progress} of {rows.length}...
            </p>
          )}

          {summary && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-emerald-600 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> {summary.success} {entityLabelPlural.toLowerCase()} added
              </p>
              {summary.failed > 0 && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-rose-600 flex items-center gap-1.5">
                    <XCircle className="w-4 h-4" /> {summary.failed} failed
                  </p>
                  <div className="max-h-32 overflow-y-auto text-xs text-rose-500 space-y-0.5">
                    {summary.errors.map((e, i) => (
                      <p key={i}>{e}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t border-white/40">
            <Button type="button" variant="ghost" onClick={close}>
              {summary ? 'Close' : 'Cancel'}
            </Button>
            {!summary && (
              <Button type="button" disabled={rows.length === 0 || uploading} onClick={handleSubmit}>
                {uploading ? 'Uploading...' : `Confirm & Upload ${rows.length || ''} ${entityLabelPlural}`}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
