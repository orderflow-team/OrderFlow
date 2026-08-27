import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  it('is defined and extends the passport jwt AuthGuard', () => {
    const guard = new JwtAuthGuard();
    expect(guard).toBeDefined();
    expect(typeof guard.canActivate).toBe('function');
  });
});
