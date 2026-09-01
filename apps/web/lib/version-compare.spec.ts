import { describe, it, expect } from 'vitest';
import { compareVersions } from './version-compare';

describe('compareVersions', () => {
  it('returns 0 for equal versions', () => {
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
  });

  it('returns positive when a > b', () => {
    expect(compareVersions('1.10', '1.9')).toBeGreaterThan(0);
  });

  it('returns negative when a < b', () => {
    expect(compareVersions('1.2', '1.10')).toBeLessThan(0);
  });

  it('treats a missing trailing segment as 0', () => {
    expect(compareVersions('1.2', '1.2.0')).toBe(0);
    expect(compareVersions('1.2.1', '1.2')).toBeGreaterThan(0);
  });

  it('compares the major version first', () => {
    expect(compareVersions('2.0', '1.99')).toBeGreaterThan(0);
  });

  it('handles leading v and v. prefixes correctly', () => {
    expect(compareVersions('v1.18', '1.18')).toBe(0);
    expect(compareVersions('v.18', '18')).toBe(0);
    expect(compareVersions('v1.18', '1.16')).toBeGreaterThan(0);
    expect(compareVersions('1.18', 'v1.18')).toBe(0);
    expect(compareVersions('v.18', 'v1.16')).toBeGreaterThan(0);
  });
});
