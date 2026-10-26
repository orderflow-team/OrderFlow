import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Returnable containers (water jars, refill capsules…) and pickup-vs-delivery pricing. Every column
 * is nullable / defaulted and the new table is empty, so existing rows and behaviour are unaffected.
 */
export class AddReturnableContainers1789000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "is_returnable" boolean NOT NULL DEFAULT false;`);
    await queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "pickup_price" decimal(15,2);`);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "fulfillment" varchar(20) NOT NULL DEFAULT 'delivery';`);
    await queryRunner.query(`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "default_fulfillment" varchar(20);`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "container_ledger" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "business_id" uuid NOT NULL,
        "customer_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "type" varchar(20) NOT NULL,
        "quantity" decimal(12,2) NOT NULL,
        "order_id" uuid,
        "note" text,
        "client_request_id" varchar(100),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_container_ledger" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_container_ledger_business_customer" ON "container_ledger" ("business_id", "customer_id");`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_container_ledger_client_request" ON "container_ledger" ("business_id", "client_request_id") WHERE "client_request_id" IS NOT NULL;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "container_ledger";`);
    await queryRunner.query(`ALTER TABLE "customers" DROP COLUMN IF EXISTS "default_fulfillment";`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "fulfillment";`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "pickup_price";`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "is_returnable";`);
  }
}
