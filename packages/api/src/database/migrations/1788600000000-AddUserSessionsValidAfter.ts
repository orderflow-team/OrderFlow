import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Changing or resetting a password used to leave every already-issued login
 * working — an access token for 24h, and a refresh token that renews itself
 * weekly — so an attacker who had got in stayed in. Tokens issued before this
 * moment (epoch seconds) are now rejected. Epoch seconds rather than a
 * timestamp column, so there's no timezone ambiguity when comparing to a
 * token's `iat`.
 */
export class AddUserSessionsValidAfter1788600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "sessions_valid_after" bigint;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "sessions_valid_after";`);
  }
}
