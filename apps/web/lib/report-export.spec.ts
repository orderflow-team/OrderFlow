import { describe, it, expect } from 'vitest';
import { buildCsv, csvEscape, dateRangePreset, escapeHtml } from './report-export';

describe('report-export', () => {
  it('quotes commas/quotes and defuses spreadsheet formulas', () => {
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvEscape(-5)).toBe('-5');
    expect(csvEscape(null)).toBe('');
  });

  it('builds title, header and rows', () => {
    expect(buildCsv('T', ['A', 'B'], [[1, 'x']])).toBe('T\nA,B\n1,x');
  });

  it('escapes html for the print view', () => {
    expect(escapeHtml('<img onerror="x">&')).toBe('&lt;img onerror=&quot;x&quot;&gt;&amp;');
  });

  it('gives an inclusive date range for presets', () => {
    const { from, to } = dateRangePreset('lastMonth');
    expect(from <= to).toBe(true);
    expect(from.endsWith('-01')).toBe(true);
    const fy = dateRangePreset('fy');
    expect(fy.from.endsWith('-04-01')).toBe(true);
  });
});
