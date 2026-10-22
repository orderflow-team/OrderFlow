// Turns two-factor authentication off for one account, for when its owner has lost
// both the phone and the recovery codes. Run it where the production DATABASE_URL is set:
//
//   npm run reset:mfa --workspace=api -- someone@example.com            -> dry run, shows the account
//   npm run reset:mfa --workspace=api -- someone@example.com --apply    -> resets it
//
// Also signs the account out everywhere (sessions_valid_after), because whoever is
// asking may not be the owner. Verify the person out of band before running this.
// With MFA_REQUIRED_FOR_SUPER_ADMIN=true a super admin is asked to enroll again at next sign-in.

import 'reflect-metadata';
import { AppDataSource } from '../src/database/data-source';

async function main() {
  const email = process.argv.slice(2).find((a) => !a.startsWith('--'));
  const apply = process.argv.includes('--apply');
  if (!email) {
    console.error('Usage: reset-mfa.ts <email> [--apply]');
    process.exit(1);
  }

  await AppDataSource.initialize();
  const rows: Array<{ id: string; email: string; role: string; mfa_enabled: boolean }> = await AppDataSource.query(
    `SELECT id, email, role, mfa_enabled FROM users WHERE LOWER(email) = LOWER($1)`,
    [email.trim()],
  );

  if (rows.length !== 1) {
    console.error(`Expected exactly one account for ${email}, found ${rows.length}. Nothing changed.`);
    await AppDataSource.destroy();
    process.exit(1);
  }
  const user = rows[0];
  console.log(`${user.email} (${user.role}) — two-factor is ${user.mfa_enabled ? 'ON' : 'already off'}.`);

  if (!apply) {
    console.log('Dry run: nothing was written. Re-run with --apply to reset it.');
  } else {
    await AppDataSource.query(
      `UPDATE users
          SET mfa_enabled = false, mfa_secret = NULL, mfa_recovery_codes = NULL, mfa_last_step = NULL,
              sessions_valid_after = $2
        WHERE id = $1`,
      [user.id, String(Math.floor(Date.now() / 1000))],
    );
    console.log('Two-factor authentication reset and existing sessions revoked.');
  }
  await AppDataSource.destroy();
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
