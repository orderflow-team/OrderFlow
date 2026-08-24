// One-time remediation for platform-admin.service.ts's updateUser bug
// (fixed alongside this script): before that fix, a password reset done
// through the platform-admin panel stored the raw password directly in
// users.password_plain, instead of encrypting it the way every other path
// (staff/kitchen/salesman account resets) already does. This finds every row
// that still holds raw plaintext and re-encrypts it in place — never
// printing the actual password value anywhere, only which accounts were
// affected.
//
// Detection: password_plain only ever holds one of two things — genuine
// AES-256-GCM ciphertext (base64 of iv+authTag+encrypted, produced by
// encryptPassword), or, for affected rows, the literal raw password.
// Attempting to decrypt a row tells you which: real ciphertext decrypts
// cleanly, anything else fails GCM's auth-tag check and throws. There's no
// realistic false-positive path here — a plaintext password coincidentally
// forming a valid 128-bit GCM auth tag isn't something that happens.
//
// Usage (run wherever the REAL production DATABASE_URL and
// CREDENTIAL_ENCRYPTION_KEY/JWT_SECRET are set — this script can't run
// meaningfully without the same key the live app uses):
//
//   npx ts-node -P tsconfig.json scripts/reencrypt-plaintext-passwords.ts
//     -> dry run (default): reports which accounts are affected, writes nothing.
//
//   npx ts-node -P tsconfig.json scripts/reencrypt-plaintext-passwords.ts --apply
//     -> actually re-encrypts the affected rows.
//
// Always run without --apply first and check the reported list before
// re-running with --apply.

import 'reflect-metadata';
import { AppDataSource } from '../src/database/data-source';
import { User } from '../src/database/entities/user.entity';
import { encryptPassword, decryptPassword } from '../src/common/utils/credential-crypto.util';

async function main() {
  const apply = process.argv.includes('--apply');

  await AppDataSource.initialize();
  const userRepo = AppDataSource.getRepository(User);

  // password_plain has `select: false` on the entity (deliberately excluded
  // from default queries) — MUST be added back explicitly, or every row
  // comes back with password_plain === undefined despite the WHERE clause
  // (which still runs correctly against the real column) matching real rows.
  const candidates = await userRepo
    .createQueryBuilder('user')
    .select(['user.id', 'user.email', 'user.password_plain'])
    .where('user.password_plain IS NOT NULL')
    .getMany();

  const affected: { id: string; email: string }[] = [];

  for (const user of candidates) {
    let isGenuineCiphertext = true;
    try {
      decryptPassword(user.password_plain);
    } catch {
      isGenuineCiphertext = false;
    }

    if (!isGenuineCiphertext) {
      affected.push({ id: user.id, email: user.email });
      if (apply) {
        // A targeted UPDATE, not userRepo.save(user) — this entity only has
        // id/email/password_plain loaded (see the explicit .select() above),
        // and .save() on a partially-loaded entity would attempt to write
        // every other column as undefined/null too. .update() only ever
        // touches the field named here.
        await userRepo.update(user.id, { password_plain: encryptPassword(user.password_plain) });
      }
    }
  }

  console.log(`Checked ${candidates.length} row(s) with a non-null password_plain.`);
  console.log(`${affected.length} were raw plaintext.`);
  if (affected.length > 0) {
    console.log(apply ? 'Re-encrypted:' : 'Would re-encrypt (re-run with --apply to actually fix):');
    for (const a of affected) console.log(`  - ${a.email} (${a.id})`);
  }
  if (!apply && affected.length > 0) {
    console.log('\nThis was a dry run — nothing was written. Re-run with --apply to fix the rows listed above.');
  }

  await AppDataSource.destroy();
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
