import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWhatsappFieldsToBusinessesAndOrders1788400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "businesses"
      ADD COLUMN IF NOT EXISTS "whatsapp_phone_number" character varying(50),
      ADD COLUMN IF NOT EXISTS "whatsapp_instance_name" character varying(100),
      ADD COLUMN IF NOT EXISTS "whatsapp_enabled" boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS "whatsapp_connected" boolean DEFAULT false;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "businesses"
      DROP COLUMN IF EXISTS "whatsapp_phone_number",
      DROP COLUMN IF EXISTS "whatsapp_instance_name",
      DROP COLUMN IF EXISTS "whatsapp_enabled",
      DROP COLUMN IF EXISTS "whatsapp_connected";
    `);
  }
}
