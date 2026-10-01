import { getGuestScope } from './guest-scope';

describe('getGuestScope', () => {
  it('returns null for staff, so no guest restrictions apply', () => {
    expect(getGuestScope({ role: 'admin', userId: 'u1' })).toBeNull();
    expect(getGuestScope({ role: 'cashier', userId: 'guest-looking-id' })).toBeNull();
  });

  it('returns null when there is no user', () => {
    expect(getGuestScope(undefined)).toBeNull();
  });

  it('derives the table id from a table-QR guest token', () => {
    expect(getGuestScope({ role: 'guest', userId: 'guest-4b1f-uuid' })).toEqual({ kind: 'table', tableId: '4b1f-uuid' });
  });

  it('recognises a takeaway guest token', () => {
    expect(getGuestScope({ role: 'guest', userId: 'guest-takeaway-biz-1' })).toEqual({ kind: 'takeaway' });
  });
});
