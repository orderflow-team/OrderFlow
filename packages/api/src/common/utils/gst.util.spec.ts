import { gstStateCode, isInterStateSale, isValidGstin, splitGst } from './gst.util';

describe('gstStateCode', () => {
  it('returns the first 2 digits of a well-formed GSTIN', () => {
    expect(gstStateCode('27AAAAA0000A1Z5')).toBe('27');
  });

  it('returns null for undefined/null/empty input', () => {
    expect(gstStateCode(undefined)).toBeNull();
    expect(gstStateCode(null)).toBeNull();
    expect(gstStateCode('')).toBeNull();
  });

  it('returns null when the value does not start with 2 digits', () => {
    expect(gstStateCode('ABAAAAA0000A1Z5')).toBeNull();
  });

  it('trims surrounding whitespace before checking', () => {
    expect(gstStateCode('  27AAAAA0000A1Z5  ')).toBe('27');
  });
});

describe('isValidGstin', () => {
  it('treats null/undefined/empty as valid (GSTIN is optional)', () => {
    expect(isValidGstin(undefined)).toBe(true);
    expect(isValidGstin(null)).toBe(true);
    expect(isValidGstin('')).toBe(true);
    expect(isValidGstin('   ')).toBe(true);
  });

  it('rejects a value that does not match the structural pattern', () => {
    expect(isValidGstin('not-a-gstin')).toBe(false);
    expect(isValidGstin('123456789012345')).toBe(false);
  });

  it('accepts a structurally valid GSTIN with a correct checksum', () => {
    // 27AAPFU0939F1ZV is a well-known publicly-documented sample valid GSTIN.
    expect(isValidGstin('27AAPFU0939F1ZV')).toBe(true);
  });

  it('is case-insensitive (lowercase input with a correct checksum still validates)', () => {
    expect(isValidGstin('27aapfu0939f1zv')).toBe(true);
  });

  it('rejects a structurally valid GSTIN with an incorrect checksum digit', () => {
    expect(isValidGstin('27AAPFU0939F1ZA')).toBe(false);
  });

  it('rejects a value one character short', () => {
    expect(isValidGstin('27AAPFU0939F1Z')).toBe(false);
  });
});

describe('isInterStateSale', () => {
  it('returns false when either party is missing a GSTIN (defaults to intra-state)', () => {
    expect(isInterStateSale({ gst_number: '27AAAAA0000A1Z5' }, null)).toBe(false);
    expect(isInterStateSale(null, { gst_number: '07AAAAA0000A1Z5' })).toBe(false);
    expect(isInterStateSale(null, null)).toBe(false);
  });

  it('returns false when both parties are registered in the same state', () => {
    expect(isInterStateSale({ gst_number: '27AAAAA0000A1Z5' }, { gst_number: '27BBBBB1111B1Z5' })).toBe(false);
  });

  it('returns true when the parties are registered in different states', () => {
    expect(isInterStateSale({ gst_number: '27AAAAA0000A1Z5' }, { gst_number: '07BBBBB1111B1Z5' })).toBe(true);
  });
});

describe('splitGst', () => {
  it('splits evenly into CGST/SGST for an intra-state sale', () => {
    expect(splitGst(100, false)).toEqual({ cgst: 50, sgst: 50, igst: 0 });
  });

  it('assigns the full amount to IGST for an inter-state sale', () => {
    expect(splitGst(100, true)).toEqual({ cgst: 0, sgst: 0, igst: 100 });
  });

  it('handles a zero amount', () => {
    expect(splitGst(0, false)).toEqual({ cgst: 0, sgst: 0, igst: 0 });
    expect(splitGst(0, true)).toEqual({ cgst: 0, sgst: 0, igst: 0 });
  });
});
