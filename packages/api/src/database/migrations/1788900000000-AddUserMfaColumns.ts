import { MigrationInterface, QueryRunner } from 'typeorm';

/** Two-factor authentication (TOTP) columns on users. All nullable / defaulted, so existing rows are unaffected. */
export class AddUserMfaColumns1788900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_enabled" boolean NOT NULL DEFAULT false;`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_secret" text;`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_recovery_codes" text;`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_last_step" bigint;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "mfa_last_step";`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "mfa_recovery_codes";`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "mfa_secret";`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "mfa_enabled";`);
  }
}
