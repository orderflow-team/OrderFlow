// Re-encrypts every stored staff/kitchen/salesman password (users.password_plain)
// with the CURRENT CREDENTIAL_ENCRYPTION_KEY.
//
// Use it after introducing a dedicated CREDENTIAL_ENCRYPTION_KEY (rows written
// earlier were encrypted with JWT_SECRET), or after rotating that key (put the
// old value in CREDENTIAL_ENCRYPTION_KEY_PREVIOUS first). Once it reports 0 rows
// left, JWT_SECRET and the previous key no longer matter for these passwords.
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

  // password_plain is `select: false` on the entity, so it must be requested explicitly.
  const rows = await userRepo
    .createQueryBuilder('user')
    .select(['user.id', 'user.email', 'user.password_plain'])
    .where('user.password_plain IS NOT NULL')
    .getMany();

  const stale: { id: string; email: string }[] = [];
  const unreadable: { id: string; email: string }[] = [];

  for (const row of rows) {
    try {
      if (!needsReencryption(row.password_plain)) continue;
      const plain = decryptPassword(row.password_plain);
      stale.push({ id: row.id, email: row.email });
      if (apply) {
        // Targeted UPDATE: only the three columns above are loaded, so save() would null the rest.
        await userRepo.update(row.id, { password_plain: encryptPassword(plain) });
      }
    } catch {
      unreadable.push({ id: row.id, email: row.email });
    }
  }

  console.log(`Checked ${rows.length} row(s). ${stale.length} ${apply ? 're-encrypted' : 'would be re-encrypted'}, ${unreadable.length} unreadable with any known key.`);
  for (const r of stale) console.log(`  re-encrypt: ${r.email} (${r.id})`);
  for (const r of unreadable) console.log(`  UNREADABLE: ${r.email} (${r.id})`);
  if (!apply && stale.length > 0) console.log('\nDry run: nothing was written. Re-run with --apply.');

  await AppDataSource.destroy();
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
