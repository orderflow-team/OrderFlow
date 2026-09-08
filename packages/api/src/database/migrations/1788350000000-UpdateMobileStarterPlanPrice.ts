import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateMobileStarterPlanPrice1788350000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE subscription_plans
      SET price_monthly_inr = 99.00,
          price_yearly_inr = 999.00
      WHERE code = 'starter'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE subscription_plans
      SET price_monthly_inr = 59.00,
          price_yearly_inr = 599.00
      WHERE code = 'starter'
    `);
  }
}
