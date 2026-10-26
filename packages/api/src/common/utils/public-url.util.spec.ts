import * as path from 'path';
import { uploadsFilePathFromUrl } from './public-url.util';

describe('uploadsFilePathFromUrl', () => {
  const uploads = path.resolve(process.cwd(), 'uploads');

  it('resolves a bare /uploads path and an absolute URL to the same file', () => {
    const expected = path.join(uploads, 'logos', 'a.png');
    expect(uploadsFilePathFromUrl('/uploads/logos/a.png')).toBe(expected);
    expect(uploadsFilePathFromUrl('https://obix360.com/uploads/logos/a.png')).toBe(expected);
  });

  it('refuses a path that climbs out of the uploads directory', () => {
    expect(() => uploadsFilePathFromUrl('/uploads/logos/../../.env')).toThrow();
    expect(() => uploadsFilePathFromUrl('/uploads/logos/../../../../etc/passwd.png')).toThrow();
    expect(() => uploadsFilePathFromUrl('../../secret.png')).toThrow();
  });

  it('refuses paths outside uploads even without traversal segments', () => {
    expect(() => uploadsFilePathFromUrl('/etc/passwd')).toThrow();
    expect(() => uploadsFilePathFromUrl('/uploads')).toThrow();
  });
});
