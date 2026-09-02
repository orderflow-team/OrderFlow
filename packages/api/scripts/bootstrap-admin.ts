import * as path from 'path';
import * as dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { AppDataSource } from '../src/database/data-source';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env.local') });

async function main() {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!email || !password) {
    throw new Error('Set ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD before running this command.');
  }

  await AppDataSource.initialize();
  try {
    const existing = await AppDataSource.query(`SELECT id FROM users WHERE email = $1`, [email]);
    if (existing.length > 0) {
      console.log(`Admin ${email} already exists; no changes made.`);
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await AppDataSource.query(
      `INSERT INTO users (id, email, password_hash, full_name, role, is_active, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, 'super_admin', true, NOW(), NOW())`,
      [email, passwordHash, process.env.ADMIN_BOOTSTRAP_NAME || 'Platform Super Admin'],
    );
    console.log(`Created super-admin account for ${email}.`);
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
