import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * OTA releases are now signed offline (see common/utils/ota-signature.util.ts).
 * The column is nullable: releases published before signing have no signature.
 */
export class AddAppReleaseSignature1788800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "app_releases" ADD COLUMN IF NOT EXISTS "signature" text;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "app_releases" DROP COLUMN IF EXISTS "signature";`);
  }
}
