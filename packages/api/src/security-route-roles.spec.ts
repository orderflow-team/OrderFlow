import 'reflect-metadata';
import { ROLES_KEY } from './common/decorators/roles.decorator';
import { UserRole } from './common/enums/user-role.enum';
import { CustomersController } from './modules/customers/customers.controller';
import { SuppliersController } from './modules/suppliers/suppliers.controller';
import { ExpensesController } from './modules/expenses/expenses.controller';
import { CategoriesController } from './modules/categories/categories.controller';
import { OrdersController } from './modules/orders/orders.controller';
import { NotificationsController } from './modules/notifications/notifications.controller';
import { BusinessConnectionsController } from './modules/business-connections/business-connections.controller';
import { BusinessesController } from './modules/businesses/businesses.controller';

const rolesOf = (controller: { prototype: any }, method: string): UserRole[] | undefined =>
  Reflect.getMetadata(ROLES_KEY, controller.prototype[method]);

const guardsOf = (controller: any): unknown[] => Reflect.getMetadata('__guards__', controller) ?? [];

describe('destructive routes are not open to every staff role', () => {
  const ownerOrManager = [UserRole.ADMIN, UserRole.MANAGER];

  it.each([
    [CustomersController, 'remove'],
    [SuppliersController, 'remove'],
    [ExpensesController, 'remove'],
    [CategoriesController, 'remove'],
    [OrdersController, 'remove'],
    [NotificationsController, 'sendTestPush'],
    [BusinessConnectionsController, 'request'],
    [BusinessConnectionsController, 'accept'],
    [BusinessConnectionsController, 'reject'],
    [BusinessConnectionsController, 'remove'],
  ])('%p.%s requires owner or manager', (controller: any, method: string) => {
    expect(rolesOf(controller, method)).toEqual(ownerOrManager);
  });

  it.each([
    CustomersController,
    SuppliersController,
    ExpensesController,
    CategoriesController,
    OrdersController,
    NotificationsController,
    BusinessConnectionsController,
  ])('%p runs RolesGuard so @Roles is actually enforced', (controller: any) => {
    const names = guardsOf(controller).map((g: any) => g.name);
    expect(names).toContain('RolesGuard');
  });

  it('raw business creation (no plan store limit) is platform-staff only', () => {
    expect(rolesOf(BusinessesController, 'create')).toEqual([UserRole.SUPER_ADMIN]);
  });

  it('onboarding and switching workspaces are owner-only', () => {
    expect(rolesOf(BusinessesController, 'onboard')).toEqual([UserRole.ADMIN]);
    expect(rolesOf(BusinessesController, 'select')).toEqual([UserRole.ADMIN]);
  });
});
