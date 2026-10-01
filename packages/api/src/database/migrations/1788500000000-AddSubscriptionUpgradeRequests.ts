import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * There's no payment gateway yet, so a shop asks to upgrade and a super admin
 * activates the plan once the shop has paid (UPI/cash). One pending request
 * per business at a time.
 */
export class AddSubscriptionUpgradeRequests1788500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "subscription_upgrade_requests" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "business_id" uuid NOT NULL,
        "requested_by_user_id" uuid,
        "plan_code" character varying(50) NOT NULL,
        "billing_cycle" character varying(10) NOT NULL DEFAULT 'monthly',
        "status" character varying(20) NOT NULL DEFAULT 'pending',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "resolved_at" TIMESTAMP,
        "resolved_by_user_id" uuid,
        CONSTRAINT "PK_subscription_upgrade_requests" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_subscription_upgrade_requests_one_pending"
      ON "subscription_upgrade_requests" ("business_id") WHERE "status" = 'pending';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "subscription_upgrade_requests";`);
  }
}
