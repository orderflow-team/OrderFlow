// Re-encrypts everything stored under the credential key with the CURRENT
// CREDENTIAL_ENCRYPTION_KEY: staff/kitchen/salesman passwords (users.password_plain) and
// two-factor secrets (users.mfa_secret).
//
// Use it after introducing a dedicated CREDENTIAL_ENCRYPTION_KEY (rows written
// earlier were encrypted with JWT_SECRET), or after rotating that key (put the
// old value in CREDENTIAL_ENCRYPTION_KEY_PREVIOUS first). Once it reports 0 rows
// left, JWT_SECRET and the previous key no longer matter. Do not drop the previous key
// before that: an MFA secret it can no longer open means that user cannot sign in.
//
// Run where the real production DATABASE_URL and keys are set:
//
//   npm run rotate:credential-key --workspace=api            -> dry run, writes nothing
//   npm run rotate:credential-key --workspace=api -- --apply -> re-encrypts
//
// Never prints a password; only the accounts affected. Rows no known key can
// open (including raw plaintext, see reencrypt-plaintext-passwords.ts) are
// reported and left untouched.

import 'reflect-metadata';
import { AppDataSource } from '../src/database/data-source';
import { User } from '../src/database/entities/user.entity';
import { encryptPassword, decryptPassword, needsReencryption } from '../src/common/utils/credential-crypto.util';

async function main() {
  const apply = process.argv.includes('--apply');

  await AppDataSource.initialize();
  const userRepo = AppDataSource.getRepository(User);

  // password_plain and mfa_secret are `select: false`, so they must be requested explicitly.
  const rows = await userRepo
    .createQueryBuilder('user')
    .select(['user.id', 'user.email', 'user.password_plain', 'user.mfa_secret'])
    .where('user.password_plain IS NOT NULL OR user.mfa_secret IS NOT NULL')
    .getMany();

  type Field = 'password_plain' | 'mfa_secret';
  const FIELDS: Field[] = ['password_plain', 'mfa_secret'];
  const stale: { id: string; email: string; field: Field }[] = [];
  const unreadable: { id: string; email: string; field: Field }[] = [];
  let checked = 0;

  for (const row of rows) {
    for (const field of FIELDS) {
      const value = row[field];
      if (!value) continue;
      checked += 1;
      try {
        if (!needsReencryption(value)) continue;
        const plain = decryptPassword(value);
        stale.push({ id: row.id, email: row.email, field });
        if (apply) {
          // Targeted UPDATE: only the columns selected above are loaded, so save() would null the rest.
          await userRepo.update(row.id, { [field]: encryptPassword(plain) });
        }
      } catch {
        unreadable.push({ id: row.id, email: row.email, field });
      }
    }
  }

  console.log(`Checked ${checked} value(s) in ${rows.length} account(s). ${stale.length} ${apply ? 're-encrypted' : 'would be re-encrypted'}, ${unreadable.length} unreadable with any known key.`);
  for (const r of stale) console.log(`  re-encrypt ${r.field}: ${r.email} (${r.id})`);
  for (const r of unreadable) console.log(`  UNREADABLE ${r.field}: ${r.email} (${r.id})`);
  if (!apply && stale.length > 0) console.log('\nDry run: nothing was written. Re-run with --apply.');

  await AppDataSource.destroy();
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
