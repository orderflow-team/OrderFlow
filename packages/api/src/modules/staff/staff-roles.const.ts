import { UserRole } from '../../common/enums/user-role.enum';

/**
 * Roles this module is allowed to mint logins for. Admin/Guest are never
 * created here (Admin comes from signup, Guest is issued automatically for
 * table/takeaway sessions), and Salesman/Kitchen Staff keep their own
 * dedicated creation flows (salesman.service.ts / restaurant.service.ts)
 * since they're tied to domain entities (Salesman, KOT) this module doesn't
 * know about.
 */
export const ALLOWED_STAFF_ROLES = [
  UserRole.MANAGER,
  UserRole.CASHIER,
  UserRole.WAITER,
  UserRole.DELIVERY_PERSON,
  UserRole.ACCOUNTANT,
] as const;
