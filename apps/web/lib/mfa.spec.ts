import { describe, expect, it } from 'vitest';
import { isMfaChallenge } from './mfa';

describe('isMfaChallenge', () => {
  it('recognises the API challenge', () => {
    expect(isMfaChallenge({ mfaRequired: true, mfaToken: 'abc' })).toBe(true);
  });

  it.each([
    ['tokens', { access_token: 'a', refresh_token: 'r', user: {} }],
    ['flag without token', { mfaRequired: true }],
    ['empty token', { mfaRequired: true, mfaToken: '' }],
    ['flag false', { mfaRequired: false, mfaToken: 'abc' }],
    ['flag as a string', { mfaRequired: 'true', mfaToken: 'abc' }],
    ['null', null],
    ['undefined', undefined],
    ['a string', 'mfaRequired'],
  ])('does not treat %s as a challenge', (_name, value) => {
    expect(isMfaChallenge(value)).toBe(false);
  });
});
