import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Grants Lifetime Free Access (Enterprise Plan) to all existing users/stores created
 * on or before 2026-09-02T16:20:00Z.
 * New users registered after this cut-off will start on a 30-day Free Trial.
 */
export class GrantExistingUsersLifetimeFreeAccess1788345000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Fetch Enterprise Plan ID
    const planRes = await queryRunner.query(
      `SELECT id FROM subscription_plans WHERE code = 'enterprise' LIMIT 1`
    );
    const enterprisePlanId = planRes[0]?.id;

    if (enterprisePlanId) {
      // 2. Update existing business_subscriptions to active Enterprise Plan with lifetime end date (2099-12-31)
      await queryRunner.query(`
        UPDATE business_subscriptions
        SET plan_id = '${enterprisePlanId}',
            status = 'active',
            current_period_end = '2099-12-31 23:59:59',
            updated_at = NOW()
        WHERE created_at <= '2026-09-02 16:20:00'
           OR user_id IN (SELECT id FROM users WHERE created_at <= '2026-09-02 16:20:00')
           OR business_id IN (SELECT id FROM businesses WHERE created_at <= '2026-09-02 16:20:00');
      `);

      // 3. Insert active Enterprise subscription for any existing user who didn't have a business_subscriptions record
      await queryRunner.query(`
        INSERT INTO business_subscriptions (id, user_id, business_id, plan_id, status, current_period_end, created_at, updated_at)
        SELECT 
          gen_random_uuid(),
          u.id,
          u.business_id,
          '${enterprisePlanId}',
          'active',
          '2099-12-31 23:59:59',
          NOW(),
          NOW()
        FROM users u
        WHERE u.created_at <= '2026-09-02 16:20:00'
          AND NOT EXISTS (
            SELECT 1 FROM business_subscriptions bs 
            WHERE bs.user_id = u.id OR (u.business_id IS NOT NULL AND bs.business_id = u.business_id)
          );
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No-op rollback for lifetime grant migration
  }
}
