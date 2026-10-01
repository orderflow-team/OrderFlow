import { emailMatches, escapeLikePattern } from './email-match.util';

describe('emailMatches', () => {
  it('is an exact, case-insensitive comparison — never a pattern match', () => {
    const op: any = emailMatches('%@Gmail.com');

    expect(op.type).toBe('raw');
    expect(op.getSql('u.email')).toBe('LOWER(u.email) = :emailLower');
    // The wildcard text is only ever a bound value for "=", so it cannot match other accounts.
    expect(op.objectLiteralParameters).toEqual({ emailLower: '%@gmail.com' });
  });

  it('treats underscore as an ordinary character', () => {
    expect((emailMatches('john_doe@x.com') as any).objectLiteralParameters).toEqual({ emailLower: 'john_doe@x.com' });
  });
});

describe('escapeLikePattern', () => {
  it('escapes %, _ and backslash so user text matches literally', () => {
    expect(escapeLikePattern('50%_off\\')).toBe('50\\%\\_off\\\\');
    expect(escapeLikePattern('plain')).toBe('plain');
  });
});
