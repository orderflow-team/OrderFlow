import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Google sign-in (2026-09-17) added users.google_id and users.avatar_url to the
 * User entity without a migration, so a database built only from migrations
 * lacked them and every user lookup failed with "column google_id does not
 * exist". IF NOT EXISTS makes this a no-op on databases that already have them
 * (e.g. production) and repairs fresh ones.
 */
export class AddUserGoogleColumns1788700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_id" character varying(255);`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_url" text;`);
  }

  public async down(): Promise<void> {
    // Deliberately empty: these columns belong to the User entity and may predate this migration.
  }
}
